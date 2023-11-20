import Agent from './agent.js'

export default class AgentIndex {
  /** @type {API} */
  #api = null
  /** @type {Object.<string, Agent>} */
  #agents = {}
  /** @type {Object.<string, Agent[]>}*/
  #agentsByDriver = {}
  /** @type {Agent[]} */
  #agentsWithEntryPoints = []
  /** @type {Object.<string, Class>} */
  #drivers = {}

  /**
   * @param {API} api
   */
  constructor(api) {
    this.#api = api
  }

  /**
   * Need to initialize after we loaded the plugins, because plugins can register drivers.
   */
  initialize() {
    let agentsMap = this.#api.config.agents

    if (!agentsMap || Object.keys(agentsMap).length === 0) {
      this.#api.log.error('No agents configured, exiting')
      process.exit(1)
    }
    this.#api.log.info('Setting up agents')

    // Sort agents in different indexes for later lookup
    for (let agentName in agentsMap) {
      let agentConfig = agentsMap[agentName]
      let agent = this.create(agentName, agentConfig)
      this.#api.log.info(
        'Created agent',
        agentName,
        '(' + agent.driver.type + ')'
      )
      this.#agents[agentName] = agent
      if (!this.#agentsByDriver[agentConfig.type]) {
        this.#agentsByDriver[agentConfig.type] = []
      }
      this.#agentsByDriver[agentConfig.type].push(agent)
      if (agentConfig.entrypoint) {
        this.#agentsWithEntryPoints.push(agent)
      }
    }

    // If no agents have entry points, all agents are entry points
    if (this.#agentsWithEntryPoints.length === 0) {
      for (let agentName in this.all()) {
        this.#agentsWithEntryPoints.push(this.#agents[agentName])
      }
    }
  }

  async run(instructions) {
    this.#api.log.info('Running agent manager with instructions', instructions)
    for (let agent of this.withEntryPoints()) {
      let response = agent.instruct(instructions)
      this.#api.log.info('Agent', agent.name, 'responded with', await response)
    }
  }

  pause() {
    for (let agentName in this.#agents) {
      let agent = this.#agents[agentName]
      agent.driver.pause()
    }
  }

  resume() {
    for (let agentName in this.#agents) {
      let agent = this.#agents[agentName]
      agent.driver.resume()
    }
  }

  /**
   * Returns the agent with the given name.
   * @param {string} name The name of the agent to return.
   * @return {Agent} The agent with the given name.
   */
  get(name) {
    return this.#agents[name]
  }

  /**
   * Returns a map of all agents, keyed by their name.
   * @return {Object.<string, Agent>}
   */
  all() {
    return this.#agents
  }

  /**
   * Returns a list of all agents that use the given driver.
   * @param {string} driverType The type of driver to return agents for.
   * @return {Agent[]} The agents that use the given driver.
   */
  byDriver(driverType) {
    return this.#agentsByDriver[driverType]
  }

  /**
   * Returns a map of all agents that have an entry point, keyed by their name.
   * @return {{}}
   */
  withEntryPoints() {
    return this.#agentsWithEntryPoints
  }

  /**
   *  This method is used to create an agent.
   * @param {string} name The name of the agent to create.
   * @param {AgentConfig} config The configuration object for the agent.
   * @return {Agent} The agent object.
   */
  create(name, config) {
    const driver = this.getAgentDriver(name, config.driver)
    return new Agent(this.#api, name, config, driver)
  }

  /**
   * This method is used to register a driver class by type.
   * @param {string} type The type of the driver to register.
   * @param {Class} driver
   */
  registerDriver(type, driver) {
    this.#api.log.trace(`Registering driver with type ${type}.`)
    this.#drivers[type] = driver
  }

  /**
   * This method is used to get a driver object by name.
   *  @param {string} name The name of the agent for which to get the driver.
   *  @param {DriverConfig} config The configuration object for the driver.
   */
  getAgentDriver(name, config) {
    const type = config.type
    try {
      return new this.#drivers[type](this.#api, name, config)
    } catch (e) {
      console.log(e)
      throw new Error(`Driver ${type} for agent ${name} not found.`)
    }
  }
}
