import EventEmitter from 'events'

/**
 * This module is the interface between the swarm orchestration system and any plugins that are loaded.
 * It is an abstraction to allow CLI, web, and other applications to use the same system.
 */

class API extends EventEmitter {
    #config = null

    /**
     * Creates a new API object.
     * @param {Config} config The configuration object to use.
     */
    constructor(config) {
        super()
        this.#config = config
    }

    /**
     * This method is used to set the configuration object. It will emit a 'config' event when the configuration is set.
     * @param {Config} config The configuration object to set.
     * @emits {Config} A clone of the configuration object.
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
}

let singleton = null

export default function getApi(config) {
    return singleton || (singleton = new API(config))
}