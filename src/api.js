import EventEmitter from 'events'

import logger from 'console-log-level'

/**
 * This module is the interface between the swarm orchestration system and any plugins that are loaded.
 * It is an abstraction to allow CLI, web, and other applications to use the same system.
 */

/**
 * @typedef {Class} Driver
 * @description This is the interface that all drivers must implement.
 * @property {function} constructor The constructor for the driver. It will be passed the configuration object.
 * @property {string} type The type of the driver as unique identifier.
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
    #config = null
    #log = null
    #drivers = {}

    /**
     * Creates a new API object.
     * @param {Config} config The configuration object to use.
     * @param {string} loglevel The log level to use for logging.
     */
    constructor(config, loglevel) {
        super()
        this.#config = config
        this.#log = logger({level: loglevel})
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
     * This method is used to get the configuration object.
     * @return {Config} The configuration object.
     */
    get config() {
        return this.#config
    }

    /**
     * This method is used to get the logger object.
     * @return {Object} The logger object.
     */
    get log() {
        return this.#log
    }

    /**
     * This method is used to get a driver object by name.
     * @param {DriverConfig} config
     * @return {Driver} The driver object.
     */
    getAgentDriver(config) {
        return new this.#drivers[config.type](config)
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