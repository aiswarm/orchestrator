/**
 * @typedef {Object} DriverConfig
 * @description Driver-specific configuration object. Plugin packages SHOULD extend this typedef
 *   with their own provider-specific fields (model, apiKey, baseUrl, …).
 * @property {string} type The driver's unique type identifier (matches `static type` on the driver class).
 */

/**
 * @typedef {Object} AgentDriverOptions
 * @description Constructor argument shape for any class extending {@link AgentDriver}. The kernel
 *   builds this object in {@link AgentIndex#getAgentDriver} and hands it to the driver class.
 *   Drivers SHOULD destructure named fields rather than store the whole options object.
 * @property {API} api The orchestrator singleton. Use `api.log`, `api.skills`, `api.comms`, `api.emit`, `api.on`. Never `console`.
 * @property {AgentIndex} index The agent index. Use to look up sibling agents when coordination is needed.
 * @property {string} name The agent name this driver instance serves. Drivers SHOULD include this in every log line.
 * @property {AgentConfig} agentConfig The full agent configuration (instructions, description, skills, groups, driver).
 * @property {DriverConfig} driverConfig Convenience shortcut to `agentConfig.driver`. Plugin packages typically extend this typedef with their own provider fields.
 */

/**
 * Abstract base class for agent drivers.
 *
 * Subclasses MUST declare a `static type` (lower-kebab-case, used as the
 * registry key) and implement {@link AgentDriver#instruct}. The constructor
 * enforces the `static type` contract so a subclass missing or misformatting
 * it throws at instantiation rather than at registration.
 *
 * Plugin classes MUST extend this base. `api.registerAgentDriver` rejects
 * classes that do not, so the kernel can rely on the base-class invariants.
 *
 * @abstract
 */
import { assertKebabCase } from './formatChecks.js'

export default class AgentDriver {
  /**
   * Subclasses must override with a non-empty lower-kebab-case string.
   * @type {string?}
   */
  static type = null

  /**
   * @throws {TypeError} If instantiated directly, or if the subclass is missing
   *   a valid `static type`.
   */
  constructor() {
    if (new.target === AgentDriver) {
      throw new TypeError('AgentDriver is abstract and cannot be instantiated directly.')
    }
    const type = new.target.type
    if (typeof type !== 'string' || !type) {
      throw new TypeError(
        `${new.target.name}: missing required "static type" field. Add e.g. \`static type = 'openai'\` to the class.`
      )
    }
    assertKebabCase(type, `${new.target.name} static type`)
  }

  /**
   * The driver's registry key. Reads from the subclass's `static type`.
   * @return {string}
   */
  get type() {
    return this.constructor.type
  }

  /**
   * Current driver state. Subclasses should override when they have richer
   * lifecycle semantics. One of `'created' | 'idle' | 'busy' | 'paused' | 'error'`.
   * Defaults to `'created'`: a freshly-constructed driver has not done any work
   * yet. Subclasses transition to `'idle'` once they are ready to accept input.
   * @return {string}
   */
  get status() {
    return 'created'
  }

  /**
   * Process a message addressed to this driver's agent.
   * @abstract
   * @param {Message} _message
   * @return {Promise<void>}
   */

  async instruct(_message) {
    throw new Error(`${this.constructor.name}.instruct() is not implemented.`)
  }

  /**
   * Optional hook. Subclasses may override to suspend background work.
   * @return {void}
   */
  pause() {}

  /**
   * Optional hook. Subclasses may override to resume background work.
   * @return {void}
   */
  resume() {}
}
