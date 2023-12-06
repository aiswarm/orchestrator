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
    api.on('pause', this.pause)
    api.on('resume', this.resume)
  }

  /**
   * Returns the API object.
   * @return {API}
   */
  get api() {
    return this.#api
  }

  /**
   * Need to initialize after we loaded the plugins, because plugins can register drivers.
   */
  initialize() {
    let agentsMap = this.#api.config.agents

    if (!agentsMap || Object.keys(agentsMap).length === 0) {
      this.#api.log.error('No agents configured!')
      return
    }
    this.#api.log.info('Setting up agents')

    // Sort agents in different indexes for later lookup
    for (let agentName in agentsMap) {
      let agentConfig = agentsMap[agentName]
      let agent = this.create(agentName, agentConfig)
      this.#api.log.info(
          `Created agent ${agentName} with driver ${agent.driver.type}`
      )
    }

    // If no agents have entry points, map agents are entry points
    if (this.#agentsWithEntryPoints.length === 0) {
      for (let agentName in this.all()) {
        this.#agentsWithEntryPoints.push(this.#agents[agentName])
      }
    }
  }

  /**
   * @todo This can probably be moved to the index.js that manages the cli.
   * @param instructions
   * @return {Promise<void>}
   */
  async run(instructions) {
    this.#api.log.info('Sending initial instructions', instructions)
    for (let agent of this.withEntryPoints()) {
      const message = this.#api.comms.createMessage(
        agent.name,
        'user',
          instructions
      )
      this.#api.resume()
      this.#api.comms.emit(message)
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
   * Returns a map of map agents, keyed by their name.
   * @return {Object.<string, Agent>}
   */
  all() {
    return this.#agents
  }

  /**
   * Returns a list of map agents that use the given driver.
   * @param {string} driverType The type of driver to return agents for.
   * @return {Agent[]} The agents that use the given driver.
   */
  byDriver(driverType) {
    return this.#agentsByDriver[driverType]
  }

  /**
   * Returns a map of map agents that have an entry point, keyed by their name.
   * @return {Agent[]}
   */
  withEntryPoints() {
    return this.#agentsWithEntryPoints
  }

  /**
   *  This method is used to add an agent.
   * @param {string} name The name of the agent to add.
   * @param {AgentConfig} config The configuration object for the agent.
   * @return {Agent} The agent object.
   */
  create(name, config) {
    if (this.#api.groups.get(name)) {
      throw new Error(`Agent ${name} already exists as a group.`)
    }
    if (this.#agents[name]) {
      return this.#agents[name]
    }
    const agent = new Agent(this, name, config)
    this.#agents[name] = agent
    this.#agentsByDriver[config.driver.type] ??= []
    this.#agentsByDriver[config.driver.type].push(agent)
    if (config.entrypoint) {
      this.#agentsWithEntryPoints.push(agent)
    }
    return agent
  }

  /**
   * This method is used to register a driver class by type.
   * @param {string} type The type of the driver to register.
   * @param {Class} driver
   */
  registerDriver(type, driver) {
    this.#api.log.debug(`Registering driver with type ${type}.`)
    this.#drivers[type] = driver
  }

  /**
   * This method is used to get a driver object by name. Drivers are passed a number of parameters as an object.
   *  @param {string} name The name of the agent for which to get the driver.
   *  @param {AgentConfig} config The configuration object for the driver.\
   *  @param {string} instructions The initial set of instructions to use for the assistant.
   */
  getAgentDriver(name, config, instructions) {
    const type = config.driver.type
    try {
      return new this.#drivers[type]({
        api: this.#api,
        index: this,
        name,
        config, // defaults to agent config
        agentConfig: config,
        driverConfig: config.driver,
        instructions
      })
    } catch (e) {
      this.#api.log.error(e.message, e.stack)
      throw new Error(`Driver ${type} for agent ${name} not found.`)
    }
  }

  /**
   * Returns a list of available drivers.
   * @return {string[]} The available drivers.
   */
  availableDrivers() {
    return Object.keys(this.#drivers)
  }
}
