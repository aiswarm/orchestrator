import Agent from './agent.js'

export default class AgentMan {
    #api = null
    #agents = {}
    #agentsByDriver = {}
    #agentsWithEntryPoints = {}

    constructor(api) {
        this.#api = api
        api.log.info('initialize agents');
        let agentsConfig = api.config.agents

        if (!agentsConfig || Object.keys(agentsConfig).length === 0) {
            api.log.error('No agents configured')
            process.exit(1)
        }

        for (let agentName in agentsConfig) {
            let agentConfig = agentsConfig[agentName]
            let agent = new Agent(agentName, api.getAgentDriver(agentConfig))
            api.log.info('Created agent', agentName, '(' + agent.driver.type + ')' )
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
            agent.instruct(instructions)
        }
    }

    getAgent(name) {
        return this.#agents[name]
    }

    getAgentsByDriver(driverType) {
        return this.#agentsByDriver[driverType]
    }

    getAgentsWithEntryPoints() {
        return this.#agentsWithEntryPoints
    }
}