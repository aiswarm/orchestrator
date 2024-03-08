import On from 'onall'
import Message from './message.js'

/**
 * @typedef {Class} AgentSkill
 * @description This is the interface that agent skill functions must implement.
 * @constructor {AgentSkillConstructor} options The options for this skill.
 * @property {string} name The name of the skill.
 * @property {string} description The description of the skill.
 * @poroperty {Object.<string, *>} parameters The parameters of the skill. This is used to instruct the agent on how to call the skill.
 * @property {string[]} [required="<all parameters>"] The required parameters of the skill. If none are specified, all are required. Use an empty array to specify none. This is used to instruct the agent on how to call the skill.
 * @property {SkillExecutor} execute The function to execute when the skill is called.
 */

/**
 * @typedef {function} AgentSkillConstructor
 * @description This is the interface that agent skill constructors must implement.
 * @param {API} api The API object to use.
 */

/**
 * @typedef {function} SkillExecutor
 * @description This is the interface that skill executors must implement.
 * @param {Object.<string, *>} args The arguments to pass to the skill. This is a map of parameter name to value as specified in the skills parameters definition. Currently, we use the format provided by OpenAI.
 * @param {string} agentName The name of the agent that called the skill.
 */

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
   * Adds a skill to the agent.
   * @param {Class<AgentSkill>} skill The skill to add.
   */
  add(skill) {
    const skillInstance = new (skill)({
      api: this.#api
    })
    this.#skills[skillInstance.name] = skillInstance
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
   * Executes a skill.
   * @param {string} name The name of the skill to execute.
   * @param {Object} args The arguments to pass to the skill.
   * @param {string} agentName The name of the agent that called the skill.
   * @return {*} The result of the skill execution.
   * @throws {Error} If the skill is not found or an error occurs during execution.
   */
  async execute(name, args, agentName) {
    const skill = this.#skills[name]
    const message = this.#api.comms.createMessage(agentName, 'system', name, Message.skillType)
    this.#api.comms.emit(message)
    if (!skill) {
      this.emit('skillNotFound', agentName, name)
      message.status = 'notFound'
      throw new Error(`Trying to execute Skill ${name}: not found`)
    }
    try {
      this.emit('skillStarted', agentName, name, args)
      let result = await skill.execute(args, agentName)
      this.emit('skillCompleted', agentName, name, result)
      message.status = 'completed'
      return result
    } catch (e) {
      this.#api.log.error(`Error executing skill ${name}: ${e.message}`)
      this.#api.log.debug(e)
      this.emit('skillFailed', agentName, name, e)
      message.status = 'failed'

      throw new Error(`Error executing skill ${name}: ${e.message}`)
    }
  }
}