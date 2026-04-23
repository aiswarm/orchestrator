/**
 * @typedef {Object} AgentSkillOptions
 * @description Constructor argument shape for any class extending {@link AgentSkill}. The kernel
 *   builds this object in {@link Skills#add} and hands it to the skill class. Skills SHOULD
 *   destructure named fields rather than store the whole options object.
 * @property {API} api The orchestrator singleton. Use `api.log`, `api.skills`, `api.comms`, `api.config`.
 */

/**
 * Abstract base class for agent skills.
 *
 * Subclasses MUST implement {@link AgentSkill#name}, {@link AgentSkill#description},
 * and {@link AgentSkill#execute}. The kernel constructs each registered subclass once
 * with `new SkillClass({api})` and looks up instances by `name`.
 *
 * Plugin classes MUST extend this base. `api.registerAgentSkill` rejects classes
 * that do not, so the kernel can rely on the base-class invariants.
 *
 * @abstract
 */
export default class AgentSkill {
  /**
   * @throws {TypeError} If instantiated directly.
   */
  constructor() {
    if (new.target === AgentSkill) {
      throw new TypeError('AgentSkill is abstract and cannot be instantiated directly.')
    }
  }

  /**
   * Unique skill name, used as the registry key and as the tool name sent to the LLM.
   * @abstract
   * @return {string}
   */
  get name() {
    throw new Error(`${this.constructor.name} must implement get name().`)
  }

  /**
   * Human-readable description sent to the LLM as part of the tool definition.
   * @abstract
   * @return {string}
   */
  get description() {
    throw new Error(`${this.constructor.name} must implement get description().`)
  }

  /**
   * Map of parameter name → JSON-schema-ish descriptor. Sent to the LLM so it knows
   * how to call the skill. Default: no parameters.
   * @return {Object.<string, *>}
   */
  get parameters() {
    return {}
  }

  /**
   * Names of required parameters. Default: every key in {@link AgentSkill#parameters}.
   * Override with `[]` to make every parameter optional.
   * @return {string[]}
   */
  get required() {
    return Object.keys(this.parameters)
  }

  /**
   * Run the skill. Result is forwarded to the calling driver, which `JSON.stringify`s
   * it before handing it back to the LLM, so the return value must be JSON-serializable.
   * Throw to signal failure.
   * @abstract
   * @param {Object.<string, *>} _args Argument map keyed by the names declared in {@link AgentSkill#parameters}.
   * @param {string} _agentName Name of the agent that invoked the skill.
   * @return {*|Promise<*>}
   */

  async execute(_args, _agentName) {
    throw new Error(`${this.constructor.name}.execute() is not implemented.`)
  }
}
