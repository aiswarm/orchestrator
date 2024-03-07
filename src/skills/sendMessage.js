export default class SendMessage {
  #api
  #config

  constructor({api}) {
    this.#api = api
    this.#config = api.config.skills.sendMessage
  }

  get name() {
    return 'send_message'
  }

  get description() {
    return this.#config.description
  }

  get parameters() {
    return {
      target: {
        type: 'string',
        description: this.#config.parameters.target
      },
      message: {
        type: 'string',
        description: this.#config.parameters.message
      },
      type: {
        type: 'string',
        description: this.#config.parameters.type
      }
    }
  }

  get required() {
    return ['target', 'message']
  }

  execute({target, message, type}, agentName) {
    target = target.toLowerCase()
    if (target !== 'user' && !this.#api.groups.get(target) && !this.#api.agents.get(target)) {
      throw new Error(`Target ${target} is not a valid agent or group`)
    }
    const msg = this.#api.comms.createMessage(
      target,
      agentName,
      message,
      type
    )
    this.#api.comms.emit(msg)
    return '{success:true}'
  }
}