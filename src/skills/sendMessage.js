export default class SendMessage {
  #api

  constructor({api}) {
    this.#api = api
  }

  get name() {
    return 'sendMessage'
  }

  get description() {
    return 'Sends a message to a group or agent. For agents to respond you will have to instruct them to use sendMessage, and who to send it to.'
  }

  get parameters() {
    return {
      target: {
        type: 'string',
        description: 'The name of the target agent or group the message is for'
      },
      message: {
        type: 'string',
        description: 'The message to send'
      },
      type: {
        type: 'string',
        description: 'Can be ignored for now, defaults to "string" which is the only format we support at this point.'
      }
    }
  }

  get required() {
    return ['target', 'message']
  }

  execute({target, message, type}, agentName) {
    if (!this.#api.groups.get(target) && !this.#api.agents.get(target)) {
      throw new Error(`Target ${target} is not a valid agent or group`)
    }
    const msg = this.#api.comms.createMessage(
      target,
      agentName,
      message,
      type
    )
    this.#api.comms.emit(msg)
    return msg.toObject()
  }
}