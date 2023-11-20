/**
 * @typedef AgentConfig
 * @description This is the interface that all agent configuration objects must implement.
 * @property {string} type The type of the agent as unique identifier.
 * @property {string} instructions The instructions to send to this agent.
 * @property {string} description The job description of this agent.
 * @property {boolean} creator Whether this agent can create other agents or not.
 * @todo {boolean} creatable Whether this agent can be created by other agents or not.
 * @property {boolean} isolate Whether this agent should be isolated from other agents or not. Set's creator to false.
 * @property {DriverConfig} driver The driver to use for this agent.
 */

/**
 * This class handles all agent related tasks. It has access to the driver and can instruct it. It also handles the communication between the agents and the user.
 */
export default class Agent {
  #name;
  #config;
  #driver;
  #api;

  /**
   * Creates a new agent.
   * @param {API} api The API object to use.
   * @param {string} name The name of the agent.
   * @param {AgentConfig} config The configuration object for this agent.
   */
  constructor(api, name, config) {
    this.#name = name
    this.#config = config
    this.#driver = api.getAgentDriver(this)
    this.#api = api
    api.comms.on(name, (message) => {
      this.#driver.instruct(message)
    })
  }

  get name() {
    return this.#name
  }

  /**
   * Returns the type of the driver instance.
   * @return {Driver}
   */
  get driver() {
    return this.#driver
  }

  get config() {
    return this.#config
  }

  async instruct(prompt) {
    return this.#driver.instruct(this.#name, prompt)
  }
}
