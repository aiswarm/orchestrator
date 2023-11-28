import logger from 'console-log-level'
import AgentIndex from './src/agentIndex.js'
import Communications from './src/comms.js'
import Groups from './src/groups.js'
import On from 'onall'

/**
 * @typedef {Class} Driver
 * @description This is the interface that map drivers must implement.
 * @property {function} constructor The constructor for the driver. It will be passed the configuration object.
 * @property {string} type The type of the driver as unique identifier.\
 * @property {DriverConfig} config The configuration object for this driver.
 * @property {function} initialize This method is used to initialize the driver.
 * @property {function} pause This method is used to pause the driver.
 * @property {function} resume This method is used to resume the driver.
 */

/**
 * @typedef {Class} DriverConfig
 * @description This is the interface that map driver configuration objects must implement.
 * @property {string} type The type of the driver as unique identifier.
 */

/**
 * @emits {config} Emitted when setting the configuration.
 * @emits {agentCreated} Emitted when creating an agent.
 * @emits {agentDriverRegistered} Emitted when an agent driver is registered.
 * @emits {configSet} Emitted when the configuration is set. Watch out for circular references.
 * @emits {groupCreated} Emitted when creating a group.
 */
class API extends On {
  /** @type {Config} */
  #config
  /** @type {Object} */
  #log
  /** @type {Communications} */
  #comms
  #drivers = {}
  /** @type {AgentIndex} */
  #agents
  /** @type {Groups} */
  #groups

  /**
   * Creates a new API object.
   * @param {Config} config The configuration object to use.
   * @param {string} loglevel The log level to use for logging.
   */
  constructor(config, loglevel) {
    super()
    this.#config = config
    this.#log = logger({level: loglevel})
    this.#groups = new Groups(this)
    this.#comms = new Communications(this)
    this.#agents = new AgentIndex(this)
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
   * @return {Object} The logger object.
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
   * This method is used to register a driver class by type.
   * @param {string} type The type of the driver to register.
   * @param {Class} driver
   */
  registerAgentDriver(type, driver) {
    this.#agents.registerDriver(type, driver)
    this.emit('agentDriverRegistered', type)
  }
}

let singleton = null

/**
 * This method returns a singleton instance of the API object. It is used to ensure that only one instance of the API
 * object is created. Parameters are passed to the constructor of the API object only when the singleton is created.
 * @param {Config} config The configuration object to use.
 * @param {string} loglevel The log level to use for logging.
 * @return {API} The singleton instance of the API object.
 */
export default function getApi(config, loglevel) {
  return singleton || (singleton = new API(config, loglevel))
}
