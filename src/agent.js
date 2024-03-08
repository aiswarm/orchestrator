/**
 * @typedef {Object} AgentConfig
 * @description This is the interface that map agent configuration objects must implement.
 * @property {string} instructions The initial set of instructions to use for the assistant.
 * @property {string} [description] The description of the agent.
 * @property {string[]} [skills=[]] The skills assigned to the assistant.
 * @property {boolean} [entrypoint = false] Whether this agent is an entry point or not.
 * @property {DriverConfig} driver The driver to use for this agent.
 */


import Communications from './comms.js'
import Message from './message.js'

/**
 * This class handles map agent related tasks. It has access to the driver and can instruct it. It also handles the communication between the agents and the user.
 */
export default class Agent {
  #name
  #config
  #driver
  #api
  #status = 'created'
  #interval

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
    this.#driver = index.getAgentDriver(name, config)
    if (this.#driver.instruct) {
      index.api.comms.on(name, async (message) => {
        if (message.source === name && this.groups.includes(message.target) || message.type === Message.skillType) {
          return // We get duplicate messages if we're part of the group and sending a message there. To prevent this, we just ignore messages that we send to the group, since they're already on the sender thread.
        }
        message.status = 'received'
        const response = await this.#driver.instruct(message)
        if (response) {
          if (response instanceof Communications.Message) {
            response.status = 'processed'
            index.api.comms.emit(response)
          } else if (response.trim().length) {
            index.api.comms.emit(message.source, name, response)
          }
        }
      })
    }
    this.#interval = setInterval(() => {
      if(this.#status !== this.#driver.status) {
        this.#status = this.#driver.status
        this.#api.emit('agentUpdated', this)
      }
    }, 250)
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

  get status() {
    return this.#status
  }

  set status(status) {
    this.#status = status
    this.#api.emit('agentUpdated', this)
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
    clearInterval(this.#interval)
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

