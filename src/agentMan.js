import Agent from './agent.js'

export default class AgentMan {
  #api = null
  #agents = {}
  #agentsByDriver = {}
  #agentsWithEntryPoints = {}

  constructor(api) {
    this.#api = api
  }

  initialize() {
    let agentsConfig = this.#api.config.agents

    if (!agentsConfig || Object.keys(agentsConfig).length === 0) {
      this.#api.log.error('No agents configured, exiting')
      process.exit(1)
    }
    this.#api.log.info('Setting up agents');

    for (let agentName in agentsConfig) {
      let agentConfig = agentsConfig[agentName]
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
  }

  run(instructions) {
    this.#api.log.info('running agent manager with instructions', instructions);
    for (let agentName in this.#agentsWithEntryPoints) {
      let agent = this.#agentsWithEntryPoints[agentName]
      let response = agent.instruct(instructions)
      this.#api.log.info('Agent', agentName, 'responded with', response)
    }
  }

  pause() {

  }

  resume() {

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