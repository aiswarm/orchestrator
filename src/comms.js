import On from 'onall'

/**
 * This is mostly for documentation purposes, and make communication a little easier.
 */
class Message {
  static stringType = Symbol('string');
  static imageType = Symbol('image');
  static videoType = Symbol('video');
  static audioType = Symbol('audio');
  static #id = 1;

  constructor(target, source, content, type = Message.stringType) {
    this.id = Message.#id++
    this.target = target
    this.source = source
    this.content = content
    this.timestamp = Date.now()
    this.type = type
  }

  toString() {
    return (
      this.timestamp +
      ' ' +
      this.source +
      ' -> ' +
      this.target +
      ': ' +
      this.content
    )
  }

  toObject() {
    return {
      id: this.id,
      type: this.type.toString(),
      source: this.source,
      target: this.target,
      timestamp: this.timestamp,
      content: this.content,
    }
  }
}

/**
 * Handles all communications between the different agents, groups, and the user.
 * This class basically acts as an Event Emitter, but on top of that has a history and a catch-all for messages.
 */
export default class Communications extends On {
  static Message = Message;
  #history = [];

  constructor(api) {
    super()

    setInterval(() => {
      while (this.#history.length > api.config.comms.historySize)
        this.#history.shift()
    }, 1000)
  }

  get history() {
    return this.#history
  }

  /**
   * Sends a message to the target and adds it to the history.
   * @override
   * @param {string|symbol|Message} event Equal to the target of the message or simply a message object
   * @param  {...any} args The rest of the arguments, equal to the source, content, and type of the message in that order
   * @property {string} args.target - The target of the message.
   * @param {string} args[1] - The source of the message.
   * @param {string} args[2] - The content of the message.
   * @param {Message.stringType} args[3] - The type of the message.
   */
  emit(event, ...args) {
    const message =
      event instanceof Message ? event : new Message(event, ...args)
    this.#history.push(message)
    if (message.target !== 'all') {
      super.emit('all', message)
    }
    return super.emit(message.target, message)
  }

  /**
   * Creates a new message object.
   * @param {string} target The target of the message.
   * @param {string} source The source of the message.
   * @param {string} content The content of the message.
   * @param {Symbol} [type=Message.stringType] The type of the message.
   * @return {Message} The newly created message object.
   */
  createMessage(target, source, content, type = Message.stringType) {
    return new Message(target, source, content, type)
  }
}
