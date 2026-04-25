import On from 'onall'
import Message from './message.js'
import { assertValidSkill, assertValidSkillClass } from './validators.js'

/** @typedef {typeof import('./agentSkill.js').default} AgentSkillClass */

/**
 * Manages and executes all available skills. Skills are commands that can be executed by agents.
 */
export default class Skills extends On {
  #api
  #skills = {}
  #collections = {}

  constructor(api) {
    super()
    this.#api = api
  }

  /**
   * Adds a skill class. The kernel verifies the class extends AgentSkill, then constructs
   * it once with `new SkillClass({api})`, validates the resulting instance, and registers
   * it under `instance.name`.
   * @param {AgentSkillClass} SkillClass The skill class to add.
   * @throws {TypeError} If the class does not extend AgentSkill, or the constructed instance
   *   fails {@link assertValidSkill}.
   * @throws {Error} If another skill with the same name is already registered.
   */
  add(SkillClass) {
    assertValidSkillClass(SkillClass)
    const instance = new SkillClass({ api: this.#api })
    assertValidSkill(instance, SkillClass.name || '<anonymous>', Object.keys(this.#skills))
    this.#skills[instance.name] = instance
  }

  addSkillCollection(name, skills) {
    this.#collections[name] = skills
  }

  getSkillsCollection(name) {
    return this.#collections[name]
  }

  /**
   * Returns a list of all available skills.
   * @return {string[]}
   */
  list() {
    return Object.keys(this.#skills)
  }

  get(name) {
    return this.#skills[name]
  }

  /**
   * Executes a skill on behalf of an agent. The single options object keeps
   * the call site self-describing and matches the skill-call shape used
   * across the orchestrator.
   * @param {Object} opts
   * @param {string} opts.agentName Name of the agent on whose behalf the skill runs; used as the target of the bookkeeping `Message.type.skill` message.
   * @param {string} opts.name The skill's registered name.
   * @param {Object} [opts.args={}] Skill arguments.
   * @return {Promise<*>} The skill's result, forwarded to the calling driver. Must be JSON-serializable.
   * @throws {Error} If the skill is not found or fails.
   */
  async invoke({ agentName, name, args = {} }) {
    const skill = this.#skills[name]
    const message = this.#api.comms.createMessage(
      agentName,
      'system',
      name,
      Message.type.skill,
      Message.state.created,
      args
    )
    this.#api.comms.emit(message)
    if (!skill) {
      this.emit('skillNotFound', agentName, name)
      message.status = Message.state.error
      throw new Error(`Trying to execute Skill ${name}: not found`)
    }
    try {
      this.emit('skillStarted', agentName, name, args)
      const result = await skill.execute(args, agentName)
      this.emit('skillCompleted', agentName, name, result)
      message.status = Message.state.complete
      return result
    } catch (e) {
      this.#api.log.error(`Error executing skill ${name}: ${e.message}`)
      this.#api.log.debug(e)
      this.emit('skillFailed', agentName, name, e)
      message.status = Message.state.error

      throw new Error(`Error executing skill ${name}: ${e.message}`, { cause: e })
    }
  }
}
