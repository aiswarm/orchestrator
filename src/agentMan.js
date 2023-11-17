import Agent from './agent.js'

export default class AgentMan {
  #api = null
  #agents = {}
  #agentsByDriver = {}
  #agentsWithEntryPoints = {}

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
    this.#api.log.info('Setting up agents');

    // Sort agents in different indexes for later lookup
    for (let agentName in agentsMap) {
      let agentConfig = agentsMap[agentName]
      let agent = new Agent(agentName, this.#api.getAgentDriver(agentConfig, agentName))
      this.#api.log.info('Created agent', agentName, '(' + agent.driver.type + ')')
      this.#agents[agentName] = agent
      if (!this.#agentsByDriver[agentConfig.type]) {
        this.#agentsByDriver[agentConfig.type] = []
      }
      this.#agentsByDriver[agentConfig.type].push(agent)
      if (agentConfig.entrypoint) {
        this.#agentsWithEntryPoints[agentName] = agent
      }
    }

    // If no agents have entry points, all agents are entry points
    if (Object.keys(this.#agentsWithEntryPoints).length === 0) {
      this.#agentsWithEntryPoints = this.#agents
    }
  }

  async run(instructions) {
    this.#api.log.info('Running agent manager with instructions', instructions);
    for (let agentName in this.#agentsWithEntryPoints) {
      let agent = this.#agentsWithEntryPoints[agentName]
      let response = agent.instruct(instructions)
      this.#api.log.info('Agent', agentName, 'responded with', await response)
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

  getAgent(name) {
    return this.#agents[name]
  }

  getAgents() {
    return this.#agents
  }

  getAgentsByDriver(driverType) {
    return this.#agentsByDriver[driverType]
  }

  getAgentsWithEntryPoints() {
    return this.#agentsWithEntryPoints
  }
}