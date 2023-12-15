export default class CreateAgent {
  #api

  constructor({api}) {
    this.#api = api
  }

  get name() {
    return 'createAgent'
  }

  get description() {
    return 'Creates a new agent that will you can communicate with via sendMessage'
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: 'The name of the agent to create'
      },
      driver: {
        type: 'string',
        description: 'The type of driver to use for the agent. Options are: ' + this.#api.agents.availableDrivers().join(', ') + '. If you need more information about the skills, use getSkillInfo'
      },
      description: {
        type: 'string',
        description: 'A description of the agent'
      },
      instructions: {
        type: 'string',
        description: 'Initial Instructions for the agent to follow'
      },
      skills: {
        type: 'array',
        description: 'An array of skills to assign to the agent. Options are: ' + this.#api.skills.list().join(', '),
        items: {
          type: 'string'
        }
      }
    }
  }

  get required() {
    return ['name', 'driver']
  }

  execute({name, driver}) {
    if (this.#api.agents.get(name)) {
      return `Agent ${name} already exists`
    }

    const agent = this.#api.agents.create(name, {
      driver: {
        type: driver
      }
    })

    return {
      name: agent.name,
      type: 'agent',
      groups: agent.groups,
      driver: agent.driver.type
    }
  }
}