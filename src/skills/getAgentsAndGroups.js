/**
 * @type {AgentSkill} TimeAndDateSkill
 */
export default class GetAgentsAndGroups {
  #api
  #config

  constructor({api}) {
    this.#api = api
    this.#config = api.config.skills.getAgentsAndGroups
  }

  get name() {
    return 'get_agents_groups'
  }

  get description() {
    return this.#config.description
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: this.#config.parameters.name
      }
    }
  }

  get required() {
    return []
  }

  execute({name}) {
    if (name && name.trim().length) {
      const agent = this.#api.agents.get(name)
      if (agent) {
        return {
          name: agent.name,
          type: 'agent',
          groups: agent.groups,
          driver: agent.driver.type
        }
      }

      const group = this.#api.groups.get(name)
      if (group) {
        return {
          name: group.name,
          type: 'group',
          members: group.members?.map(agent => agent.name) ?? []
        }
      }
    } else {
      return {
        agents: this.#api.agents.all(),
        groups: this.#api.groups.list()
      }
    }
    return null
  }
}