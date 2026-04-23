import On from 'onall'
import AgentIndex from './agentIndex.js'
import Communications from './comms.js'
import ContextProviders from './contextProviders.js'
import Groups from './groups.js'
import Skills from './skills.js'
import { assertValidDriver } from './validators.js'

/**
 * @typedef {Object} Logger
 * @property {LogFunction} trace
 * @property {LogFunction} debug
 * @property {LogFunction} info
 * @property {LogFunction} warn
 * @property {LogFunction} error
 */

/**
 * @callback LogFunction
 * @param {string} message
 * @param {...any} args
 */

/** @typedef {typeof import('./agentDriver.js').default} AgentDriverClass */
/** @typedef {typeof import('./agentSkill.js').default} AgentSkillClass */

/**
 * The orchestrator's central API singleton. Extends {@link On} (an
 * `EventEmitter`) so plugins, drivers, skills, and UIs integrate by listening
 * to events rather than calling methods.
 *
 * ## Events emitted on this object
 *
 * Subscribe with `api.on(event, handler)` (or `api.once(...)`).
 *
 * | Event                        | Payload                                              | Emitted from                       | When |
 * |------------------------------|------------------------------------------------------|------------------------------------|------|
 * | `configSet`                  | `(config)` deep-cloned snapshot                      | {@link API#config} setter          | Configuration replaced at runtime. Watch out for circular references when serializing. |
 * | `agentCreated`               | `(agent)` the new {@link Agent}                      | {@link API#registerAgent}          | A new agent has been constructed and registered. |
 * | `agentUpdated`               | `(agent)`                                            | {@link Agent} status changes       | Agent status field changed (driver heartbeat or explicit setter). |
 * | `agentDriverRegistered`      | `(type, driver)`                                     | {@link API#registerAgentDriver}    | A driver class has been added to the registry. |
 * | `agentSkillRegistered`       | `(skill)`                                            | {@link API#registerAgentSkill}     | A skill class has been added to the registry. |
 * | `contextProviderRegistered`  | `(provider)`                                         | {@link API#registerContextProvider}| A context-provider singleton has been added to the registry. |
 * | `groupCreated`               | `(name)`                                             | {@link API#registerGroup}          | A new group has been created at the API level. |
 * | `messageUpdated`             | `(message)` the {@link Message}                      | {@link Message} mutators           | A message's status or content changed after dispatch. |
 * | `contextReady`               | `({agent, message})`                                 | agent loop                         | Per-turn context enrichment finished and was attached to the message; fired only when the agent has a `context` opt-in list. |
 * | `agentTurnCompleted`         | `({agent, finalMessage, contextMetadata})`           | agent loop                         | The driver's `instruct()` returned and the agent finished one turn. `contextMetadata` is `undefined` when no context providers ran. |
 * | `contextProviderError`       | `({agent, providerName, error})`                     | {@link ContextProviders}           | A context provider's `contribute()` threw; the kernel recorded an error entry and the turn continued. |
 * | `pluginsLoaded`              | `()`                                                 | {@link loadPlugins}                | Every plugin's `initialize(api)` has resolved. Listeners may return promises; the loader awaits them via {@link API#emitAsync} before agents start. |
 * | `paused` / `resumed`         | `()`                                                 | {@link API#pause}/{@link API#resume}| The orchestrator's run flag toggled. |
 *
 * ## Events emitted on sub-managers
 *
 * Each manager is its own `EventEmitter`; subscribe via the property it lives
 * on, not on `api` directly.
 *
 * | Event                        | Payload                              | Emitter           |
 * |------------------------------|--------------------------------------|-------------------|
 * | `all`                        | `(message)`                          | {@link API#comms} (also fires the per-target event with the same payload) |
 * | `created` / `updated` / `removed` | `(name, members)` / `(name)`    | {@link API#groups}|
 * | `skillStarted`               | `(agentName, skillName, args)`       | {@link API#skills}|
 * | `skillCompleted`             | `(agentName, skillName, result)`     | {@link API#skills}|
 * | `skillFailed`                | `(agentName, skillName, error)`      | {@link API#skills}|
 * | `skillNotFound`              | `(agentName, skillName)`             | {@link API#skills}|
 *
 * When adding a new event, document it here so consumers have a single
 * lookup point.
 */
class API extends On {
  /** @type {Config} */
  #config
  /** @type {Logger} */
  #log
  /** @type {Communications} */
  #comms
  /** @type {AgentIndex} */
  #agents
  /** @type {Groups} */
  #groups
  /** @type {boolean} */
  #running = false
  /** @type {Skills} */
  #skills
  /** @type {ContextProviders} */
  #contextProviders

  /**
   * Creates a new API object.
   * @param {Config} config The configuration object to use.
   * @param {Object} log The logger to use for logging.
   */
  constructor(config, log) {
    super()
    this.#config = config
    this.#log = log
    this.#groups = new Groups(this)
    this.#comms = new Communications(this)
    this.#agents = new AgentIndex(this)
    this.#skills = new Skills(this)
    this.#contextProviders = new ContextProviders(this)
  }

  /**
   * This method is used to get the configuration object.
   * @return {Config} The configuration object.
   */
  get config() {
    return this.#config
  }

  /**
   * This method is used to set the configuration object. It will emit a 'config' event when the configuration is set.
   * @param {Config} config The configuration object to set.
   */
  set config(config) {
    this.#config = config
    this.emit('configSet', JSON.parse(JSON.stringify(config)))
  }

  /**
   * This method is used to get the logger object.
   * @return {Logger} The logger object.
   */
  get log() {
    return this.#log
  }

  /**
   * This method is used to get the communications object.
   * @return {Communications}
   */
  get comms() {
    return this.#comms
  }

  /**
   * This method is used to get the agent manager instance.
   * @return {AgentIndex} The agent manager instance.
   */
  get agents() {
    return this.#agents
  }

  /**
   * This method is used to get the group manager instance.
   * @return {Groups}
   */
  get groups() {
    return this.#groups
  }

  get skills() {
    return this.#skills
  }

  /**
   * @return {ContextProviders}
   */
  get contextProviders() {
    return this.#contextProviders
  }

  /**
   * This method is used to get the running state of the API.
   * @return {boolean}
   */
  get running() {
    return this.#running
  }

  /**
   * This method is used to add an agent.
   * @param {string} name The name of the agent.
   * @param {AgentConfig} config The configuration object for the agent.
   * @return {Agent} The agent object.
   */
  createAgent(name, config) {
    const agent = this.#agents.create(name, config)
    this.emit('agentCreated', agent)
    return agent
  }

  /**
   * This method is used to add a group. If the group already exists, it will be returned.
   * @param {string} name The name of the group.
   * @return {string[]} The group array. that holds the names of the agents in the group.
   */
  createGroup(name) {
    if (this.#groups.add(name)) {
      this.emit('groupCreated', name)
      return []
    }
    return this.#groups.get(name)
  }

  /**
   * Register a driver class. The driver's `static type` field is the registry key.
   * @param {AgentDriverClass} driver
   * @throws {TypeError} If the class fails {@link assertValidDriver}.
   * @throws {Error} If another driver is already registered with the same type.
   */
  registerAgentDriver(driver) {
    assertValidDriver(driver, this.#agents.availableDrivers())
    const type = driver.type
    this.#agents.registerDriver(driver)
    this.#config.drivers ??= {}
    this.#config.drivers[type] ??= {}
    this.emit('agentDriverRegistered', type, driver)
  }

  /**
   * Register a skill class. The class is instantiated immediately with `new SkillClass({api})`
   * and the instance is validated against the skill contract.
   * @param {AgentSkillClass} skill The skill class.
   * @throws {TypeError} If the constructed instance fails the skill contract.
   * @throws {Error} If another skill with the same name is already registered.
   */
  registerAgentSkill(skill) {
    this.#skills.add(skill)
    this.emit('agentSkillRegistered', skill)
  }

  /**
   * Register a context-provider singleton (RAG/memory/retriever/etc.). The
   * registry key is `provider.name`.
   * @param {Object} provider
   * @throws {TypeError} If the provider fails the context-provider contract.
   * @throws {Error} If the name collides with an already-registered provider.
   */
  registerContextProvider(provider) {
    this.#contextProviders.add(provider)
    this.emit('contextProviderRegistered', provider)
  }

  /**
   * Like {@link emit}, but awaits any promises returned by listeners. Use this
   * for lifecycle events whose listeners may need to perform async work that
   * the caller must wait for (e.g. `pluginsLoaded` warming up DB-backed
   * context providers before agents start).
   * @param {string|symbol} event
   * @param {...*} args
   * @return {Promise<boolean>} Resolves once every listener's returned
   *   promise (if any) has settled. Resolves to `true` if there were any
   *   listeners, mirroring `EventEmitter.emit`.
   */
  async emitAsync(event, ...args) {
    const listeners = this.listeners(event)
    await Promise.all(listeners.map(fn => fn(...args)))
    return listeners.length > 0
  }

  pause() {
    this.#running = false
    this.emit('paused')
  }

  resume() {
    this.#running = true
    this.emit('resumed')
  }
}

let singleton = null

/**
 * This method returns a singleton instance of the API object. It is used to ensure that only one instance of the API
 * object is created. Parameters are passed to the constructor of the API object only when the singleton is created.
 * @param {Config} config The configuration object to use.
 * @param {Object} log The logger to use for logging.
 * @return {API} The singleton instance of the API object.
 */
export default function getApi(config, log) {
  return singleton || (singleton = new API(config, log))
}
