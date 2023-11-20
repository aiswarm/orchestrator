import Agent from './agent.js'

export default class AgentMan {
  #api = null;
  #agents = {};
  #agentsByDriver = {};
  #agentsWithEntryPoints = [];

  /**
   * @param {API} api
   */
  constructor(api) {
    this.#api = api
  }

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
      let agent = new Agent(this.#api, agentName, agentConfig)
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
      for (let agentName in this.#agents) {
        this.#agentsWithEntryPoints.push(this.#agents[agentName])
      }
    }
  }

  async run(instructions) {
    this.#api.log.info('Running agent manager with instructions', instructions)
    for (let agent of this.#agentsWithEntryPoints) {
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
  getAgent(name) {
    return this.#agents[name]
  }

  /**
   * Returns a map of all agents, keyed by their name.
   * @return {Object.<string, Agent>}
   */
  getAgents() {
    return this.#agents
  }

  /**
   * Returns a list of all agents that use the given driver.
   * @param {string} driverType The type of driver to return agents for.
   * @return {Agent[]} The agents that use the given driver.
   */
  getAgentsByDriver(driverType) {
    return this.#agentsByDriver[driverType]
  }

  /**
   * Returns a map of all agents that have an entry point, keyed by their name.
   * @return {{}}
   */
  getAgentsWithEntryPoints() {
    return this.#agentsWithEntryPoints
  }
}
