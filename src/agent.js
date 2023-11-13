/**
 * @typedef AgentConfig
 * @description This is the interface that all agent configuration objects must implement.
 * @property {string} type The type of the agent as unique identifier.
 * @property {string} instructions The instructions to send to this agent.
 * @property {string} description The job description of this agent.
 * @property {boolean} creator Whether this agent can create other agents or not.
 * @property {boolean} isolate Whether this agent should be isolated from other agents or not. Set's creator to false.
 * @property {DriverConfig} driver The driver to use for this agent.
 */

/**
 * This class handles all agent related tasks. It has access to the driver and can instruct it.
 */
export default class Agent {
    #name;
    #config;
    #driver;

    /**
     *
     * @param {string} name
     * @param driver
     * @param {Driver} driver The driver to use for this agent. At this point it already received its configuration and is ready to use.
     */
    constructor(name, driver) {
        this.#name = name
        this.#driver = driver
    }

    get name() {
        return this.#name
    }

    get driver() {
        return this.#driver
    }

    async instruct(prompt) {
        return this.#driver.instruct(prompt)
    }
}