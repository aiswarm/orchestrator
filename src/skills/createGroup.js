export default class CreateGroup {
  #api

  constructor({api}) {
    this.#api = api
  }

  get name() {
    return 'createGroup'
  }

  get description() {
    return 'Creates a new group that you can send messages to. Agents can be added to the group later.'
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: 'The name of group to create'
      },
      members: {
        type: 'array',
        description: 'The names of agents to add to the group',
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

    this.#api.groups.create(name, members)

    return {
      name,
      members: this.#api.groups.get(name)
    }
  }
}