
/**
 * This is mostly for documentation purposes, and make communication a little easier.
 */
export default class Message {
  static stringType = Symbol('string')
  static imageType = Symbol('image')
  static videoType = Symbol('video')
  static audioType = Symbol('audio')
  static #idCounter = 1

  #api
  #id
  #target
  #source
  #content
  #type
  #timestamp
  #status

  constructor(api, target, source, content, type = Message.stringType, status = 'created') {
    this.#api = api
    this.#id = Message.#idCounter++
    this.#target = target
    this.#source = source
    this.#content = content
    this.#status = status
    this.#timestamp = new Date()
    if (typeof type === 'string') {
      switch (type) {
      case 'image':
        type = Message.imageType
        break
      case 'video':
        type = Message.videoType
        break
      case 'audio':
        type = Message.audioType
        break
      default:
        type = Message.stringType
        break
      }
    }
    this.#type = type
  }

  get status() {
    return this.#status
  }

  set status(status) {
    this.#status = status
    this.#api.log.debug('Message', this.toString(), 'status changed to', status)
    this.#api.emit('messageUpdated', this)
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

  /**
   * Returns a locale dependent string representation of the messageInput.
   * @return {string} A string representation of the messageInput.
   */
  toString() {
    switch (this.type) {
    case Message.imageType:
      return `Image ${this.id} from ${this.source} to ${
        this.target
      } at ${this.timestamp.toLocaleTimeString()} is ${this.status}`
    case Message.videoType:
      return `Video ${this.id} from ${this.source} to ${
        this.target
      } at ${this.timestamp.toLocaleTimeString()} is ${this.status}`
    case Message.audioType:
      return `Audio ${this.id} from ${this.source} to ${
        this.target
      } at ${this.timestamp.toLocaleTimeString()} is ${this.status}`
    default:
      return `Message ${this.id} from ${this.source} to ${
        this.target
      } at ${this.timestamp.toLocaleTimeString()} is ${this.status}: ${this.content}`
    }
  }

  /**
   * Returns a primitive object representation of the messageInput. No methods or non-primitive objects are used.
   * @return {Object} An object representation of the messageInput.
   */
  toObject() {
    return {
      id: this.#id,
      source: this.#source,
      target: this.#target,
      content: this.#content,
      type: this.#type.toString().slice(7, -1),
      timestamp: this.#timestamp.toISOString(),
      status: this.#status
    }
  }
}