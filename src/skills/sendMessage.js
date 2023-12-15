export default class SendMessage {
  #api

  constructor({api}) {
    this.#api = api
  }

  get name() {
    return 'sendMessage'
  }

  get description() {
    return 'Sends a message to a group or agent. Agents will respond if they are able to process the message. Groups will forward the message to all members'
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