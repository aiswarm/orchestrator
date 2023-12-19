import On from 'onall'
import History from './history.js'
import Message from './message.js'

/**
 * Handles map communications between the different agents, groups, and the user.
 * This class basically acts as an Event Emitter, but on top of that has a history and a catch-map for messages.
 */
export default class Communications extends On {
  static Message = Message
  #api
  #history

  constructor(api) {
    super()
    this.#api = api
    this.#history = new History(api)
  }

  get history() {
    return this.#history
  }

  /**
   * Sends a messageInput to the target and adds it to the history.
   * @override
   * @param {string|symbol|Message|Object} event Equal to the target of the messageInput or simply a messageInput object
   * @param  {...any} args The rest of the arguments, equal to the source, content, and type of the messageInput in that order
   * @property {string} args.target - The target of the messageInput.
   * @param {string} args[0] - The source of the messageInput.
   * @param {string} args[1] - The content of the messageInput.
   * @param {Message.stringType} args[2] - The type of the messageInput.
   * @return {boolean} True if the messageInput was sent successfully.
   */
  emit(event, ...args) {
    if (!this.#api.running) {
      throw new Error('Cannot send messages when the API is not running.')
    }
    const message =
      event instanceof Message
        ? event
        : event instanceof Object
          ? new Message(this.#api, event.target, event.source, event.content, event.type)
          : new Message(this.#api, event, args[0], args[1], args[2])
    this.#history.add(message)

    if (message.target !== 'all') {
      super.emit('all', message)
    }
    // if target is a group, send to map members of the group and send to the group
    if (this.#api.groups.get(message.target)) {
      for (const member of this.#api.groups.get(message.target)) {
        super.emit(member, message)
      }
    }
    return super.emit(message.target, message)
  }

  /**
   * Creates a new messageInput object.
   * @param {string} target The target of the messageInput.
   * @param {string} source The source of the messageInput.
   * @param {string} content The content of the messageInput.
   * @param {Symbol} [type=Message.stringType] The type of the messageInput.
   * @return {Message} The newly created messageInput object.
   */
  createMessage(target, source, content, type = Message.stringType) {
    return new Message(this.#api, target, source, content, type)
  }
}
