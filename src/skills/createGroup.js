export default class CreateGroup {
  #api
  #config

  constructor({api}) {
    this.#api = api
    this.#config = api.config.skills.createGroup
  }

  get name() {
    return 'create_group'
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
      members: {
        type: 'array',
        description: this.#config.parameters.members,
        items: {
          type: 'string'
        }
      }
    }
  }

  get required() {
    return ['name']
  }

  execute({name, members}) {
    if (this.#api.groups.get(name)) {
      return `Group ${name} already exists`
    }

    this.#api.groups.add(name, members)

    return {
      name,
      members: this.#api.groups.get(name)
    }
  }
}