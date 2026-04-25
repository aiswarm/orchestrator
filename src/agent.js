/**
 * @typedef {Object} AgentConfig
 * @description The per-agent configuration as written in the user's config file.
 * @property {string} instructions The initial set of instructions to use for the assistant.
 * @property {string} [description] The description of the agent.
 * @property {string[]} [skills=[]] The skills assigned to the assistant.
 * @property {string[]} [groups] The groups this agent belongs to.
 * @property {string[]} [contexts=[]] Names of registered context providers that enrich messages to this agent (see doc/context-provider-contract.md). Per-provider options live under the global `contexts.{name}` config section, not on the agent.
 * @property {boolean} [entrypoint=false] Whether this agent is an entry point or not.
 * @property {DriverConfig} driver The driver to use for this agent.
 */

import Message from './message.js'
import Communications from './comms.js'

/**
 * This class handles map agent related tasks. It has access to the driver and can instruct it. It also handles the communication between the agents and the user.
 */
export default class Agent {
  #name
  #config
  #driver
  #api

  /**
   * Creates a new agent.
   * @param {AgentIndex} index The API object to use.
   * @param {string} name The name of the agent.
   * @param {AgentConfig} config The configuration object for this agent.
   */
  constructor(index, name, config) {
    this.#api = index.api
    this.#name = name
    this.#config = config
    this.#config.skills ??= []
    this.#expandSkillCollections(config)
    this.#api.contextProviders.validateAgentContexts(name, config.contexts)
    this.#driver = index.getAgentDriver(name, config)
    if (this.#driver.instruct) {
      index.api.comms.on(name, async message => {
        if (
          (message.source === name && this.groups.includes(message.target)) ||
          message.type === Message.type.skill
        ) {
          return // We get duplicate messages if we're part of the group and sending a message there. To prevent this, we just ignore messages that we send to the group, since they're already on the sender thread.
        }
        const context = await this.#api.contextProviders.enrich({
          agent: this,
          incomingMessage: message
        })
        if (context !== undefined) {
          message.context = context
          this.#api.emit('contextReady', { agent: this, message })
        }
        const response = await this.#driver.instruct(message)
        const contextMetadata = context
          ? context.entries.map(e => ({ name: e.name, metadata: e.metadata, error: e.error }))
          : undefined
        if (response) {
          if (response instanceof Communications.Message) {
            response.status = Message.state.processed
            index.api.comms.emit(response)
          } else if (response.trim().length) {
            const replyTarget = this.#api.groups.get(message.target)
              ? message.target
              : message.source
            index.api.comms.emit(replyTarget, name, response)
          }
        }
        this.#api.emit('agentTurnCompleted', {
          agent: this,
          finalMessage: response,
          contextMetadata
        })
      })
    }
    if (typeof this.#driver.on === 'function') {
      this.#driver.on('statusChanged', () => this.#api.emit('agentUpdated', this))
    }
  }

  get name() {
    return this.#name
  }

  /**
   * Returns the type of the driver instance.
   * @return {AgentDriver}
   */
  get driver() {
    return this.#driver
  }

  get config() {
    return this.#config ?? {}
  }

  get groups() {
    return this.#config.groups ?? []
  }

  /**
   * Convenience accessor exposing this agent's communications history.
   * @return {History}
   */
  get history() {
    return this.#api.comms.history
  }

  /**
   * The driver is the single source of truth for status; this getter just
   * delegates.
   * @return {string}
   */
  get status() {
    return this.#driver.status
  }

  async instruct(prompt) {
    return this.#driver.instruct(prompt)
  }

  resume() {
    if (this.#driver.resume) {
      this.#driver.resume()
    }
  }

  pause() {
    if (this.#driver.pause) {
      this.#driver.pause()
    }
  }

  remove() {
    if (this.#driver.remove) {
      this.#driver.remove(this)
    }
  }

  #expandSkillCollections(config) {
    if (!config.skills) {
      return
    }
    for (const skillName of config.skills) {
      const collection = this.#api.skills.getSkillsCollection(skillName)
      if (collection) {
        config.skills.splice(config.skills.indexOf(skillName), 1, ...collection)
      }
    }
  }
}
