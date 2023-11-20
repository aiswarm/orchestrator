import EventEmitter from 'events'

import logger from 'console-log-level'
import AgentMan from './agentMan.js'
import Communications from './comms.js'

/**
 * @typedef {Class} Driver
 * @description This is the interface that all drivers must implement.
 * @property {function} constructor The constructor for the driver. It will be passed the configuration object.
 * @property {string} type The type of the driver as unique identifier.\
 * @property {DriverConfig} config The configuration object for this driver.
 * @property {function} instruct This method is used to send a prompt to the driver and return a response asynchronously.
 */

/**
 * @typedef {Class} DriverConfig
 * @description This is the interface that all driver configuration objects must implement.
 * @property {string} type The type of the driver as unique identifier.
 */

/**
 * @emits {config} Emitted when the configuration is set.
 * @emits {agentDriverRegistered} Emitted when an agent driver is registered.
 */
class API extends EventEmitter {
  #config
  #log
  #comms
  #drivers = {}
  #agentMan

  /**
   * Creates a new API object.
   * @param {Config} config The configuration object to use.
   * @param {string} loglevel The log level to use for logging.
   */
  constructor(config, loglevel) {
    super()
    this.#config = config
    this.#log = logger({level: loglevel})
    this.#comms = new Communications(this)
    this.#agentMan = new AgentMan(this)
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
    this.emit('config', JSON.parse(JSON.stringify(config)))
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
   * @return {module:events.EventEmitter}
   */
  get comms() {
    return this.#comms
  }

  /**
   * This method is used to get the agent manager instance.
   * @return {AgentMan} The agent manager instance.
   */
  get agentMan() {
    return this.#agentMan
  }

  /**
   * This method is used to get a driver object by name.
   * @param {Agent} agent The agent who will use this driver.
   * @todo This should probably move to the AgentMan class.
   */
  getAgentDriver(agent) {
    const type = agent.config.driver.type
    try {
      this.#log.trace(`Returning driver with type ${type}.`)
      return new this.#drivers[type](this, agent)
    } catch (e) {
      throw new Error(`Driver ${type} for agent ${agent.name} not found.`)
    }
  }

  /**
   * This method is used to register a driver class by type.
   * @param {string} type The type of the driver to register.
   * @param {Class} driver
   */
  registerAgentDriver(type, driver) {
    this.#drivers[type] = driver
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
