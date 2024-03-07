export default class CreateAgent {
  #api
  #config

  constructor({api}) {
    this.#api = api
    this.#config = api.config.skills.createAgent
  }

  get name() {
    return 'create_agent'
  }

  get description() {
    return this.#config.description
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: this.#config.parameters.name
      },
      driver: {
        type: 'string',
        description: this.#config.parameters.driver,
        enum: this.#api.agents.availableDrivers()
      },
      description: {
        type: 'string',
        description: this.#config.parameters.description
      },
      instructions: {
        type: 'string',
        description: this.#config.parameters.instructions
      },
      skills: {
        type: 'array',
        description: this.#config.parameters.skills,
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