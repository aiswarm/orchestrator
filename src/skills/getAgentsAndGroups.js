/**
 * @type {AgentSkill} TimeAndDateSkill
 */
export default class GetAgentsAndGroups {
  #api

  constructor({api}) {
    this.#api = api
  }

  get name() {
    return 'getAgentsAndGroups'
  }

  get description() {
    return 'Returns users and groups. Names are unique and can be used for both'
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: 'The name of the user or group to return. An agent name will return info about the agent, a group name will return all members of that group, no name will return all users and groups'
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