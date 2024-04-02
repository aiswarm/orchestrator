
/**
 * This is mostly for documentation purposes, and make communication a little easier.
 */
export default class Message {
  static type = {
    string: Symbol('string'),
    image: Symbol('image'),
    video: Symbol('video'),
    audio: Symbol('audio'),
    skill: Symbol('skill'),

    contains: (type) => {
      for (const key in Message.type) {
        if (Message.type[key] === type) {
          return true
        }
      }
      return false
    }
  }

  static state = {
    created: Symbol('created'),
    queued: Symbol('queued'),
    processing: Symbol('processing'),
    complete: Symbol('complete'),
    cancelled: Symbol('cancelled'),
    error: Symbol('error'),

    contains: (state) => {
      for (const key in Message.state) {
        if (Message.state[key] === state) {
          return true
        }
      }
      return false
    }
  }

  static #idCounter = 1
  #api
  #id
  #target
  #source
  #content
  #type
  #timestamp
  #status
  #metadata

  constructor(api, target, source, content, type = Message.type.string, status = Message.state.created, metadata= {}) {
    this.#api = api
    this.#id = Message.#idCounter++
    this.#target = target
    this.#source = source
    this.#content = content
    this.#status = status
    this.#metadata = metadata
    this.#timestamp = new Date()
    if (!Message.type.contains(type)) {
      throw new Error(`Invalid message type: ${type}`)
    }
    this.#type = type
  }

  get status() {
    return this.#status
  }

  set status(status) {
    if (this.#status === status) {
      return
    }
    if (!Message.state.contains(status)) {
      throw new Error(`Invalid message status: ${status}`)
    }
    this.#status = status
    this.#api.log.trace(`Message (${this.content.substring(0, 100)}), status changed to`, status.description)
    if (status !== Message.state.created) {
      this.#api.emit('messageUpdated', this)
    }
  }

  get id() {
    return this.#id
  }

  get source() {
    return this.#source
  }

  get target() {
    return this.#target
  }

  get content() {
    return this.#content
  }

  get timestamp() {
    return this.#timestamp
  }

  get type() {
    return this.#type
  }

  get metadata() {
    return this.#metadata
  }

  append(content)  {
    this.#content += content
    this.#api.emit('messageUpdated', this)
  }

  /**
   * Returns the value of the metadata with the given key.
   * @param {string} key The key of the metadata to get.
   * @return {*} The value of the metadata with the given key or undefined if the key does not exist.
   */
  getMetadata(key) {
    return this.#metadata[key]
  }

  /**
   * Returns a locale dependent string representation of the messageInput.
   * @return {string} A string representation of the messageInput.
   */
  toString() {
    const time = this.timestamp.toLocaleTimeString()
    switch (this.type) {
    case Message.type.image:
      return `Image ${this.id} from ${this.source} to ${this.target} at ${time} is ${this.status.description}`
    case Message.type.video:
      return `Video ${this.id} from ${this.source} to ${this.target} at ${time} is ${this.status.description}`
    case Message.type.audio:
      return `Audio ${this.id} from ${this.source} to ${this.target} at ${time} is ${this.status.description}`
    default:
      return `Message ${this.id} from ${this.source} to ${this.target} at ${time} is ${this.status.description}: ${this.content}` +
        this.#metadata ? ` with metadata ${JSON.stringify(this.metadata)}` : ''
    }
  }

  /**
   * Returns a primitive object representation of the messageInput. No methods or non-primitive objects are used.
   * @return {Object} An object representation of the messageInput.
   */
  toObject() {
    const metadata = []
    for (const key in this.#metadata) {
      metadata.push({
        key,
        value:JSON.stringify(this.#metadata[key])
      })
    }
    return {
      id: this.#id,
      source: this.#source,
      target: this.#target,
      content: this.#content,
      type: this.#type.toString().slice(7, -1),
      timestamp: this.#timestamp.toISOString(),
      status: this.#status.description,
      metadata
    }
  }
}