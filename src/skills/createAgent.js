export default class CreateAgent {
  #api

  constructor({api}) {
    this.#api = api
  }

  get name() {
    return 'Create Agent'
  }

  get description() {
    return 'Creates a new agent that you can communicate with via sendMessage.'
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: 'The name of the agent to create'
      },
      driver: {
        type: 'string',
        description: 'The type of driver to use for the agent.',
        enum: this.#api.agents.availableDrivers()
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
        description: 'An array of skills to assign to the agent',
        enum: this.#api.skills.list(),
        items: {
          type: 'string'
        }
      }
    }
  }

  get required() {
    return ['name', 'driver']
  }

  execute({name, driver, description, instructions, skills}) {
    if (this.#api.agents.get(name)) {
      return `Agent ${name} already exists`
    }

    const agent = this.#api.agents.create(name, {
      description,
      instructions,
      driver: {
        type: driver
      },
      skills: skills
    })

    return {
      name: agent.name,
      type: 'agent',
      groups: agent.groups,
      driver: agent.driver.type
    }
  }
}