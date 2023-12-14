
/**
 * This is mostly for documentation purposes, and make communication a little easier.
 */
export default class Message {
  static stringType = Symbol('string')
  static imageType = Symbol('image')
  static videoType = Symbol('video')
  static audioType = Symbol('audio')
  static #id = 1

  constructor(target, source, content, type = Message.stringType) {
    this.id = Message.#id++
    this.target = target
    this.source = source
    this.content = content
    this.timestamp = new Date()
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
    this.type = type
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
      } at ${this.timestamp.toLocaleTimeString()}`
    case Message.videoType:
      return `Video ${this.id} from ${this.source} to ${
        this.target
      } at ${this.timestamp.toLocaleTimeString()}`
    case Message.audioType:
      return `Audio ${this.id} from ${this.source} to ${
        this.target
      } at ${this.timestamp.toLocaleTimeString()}`
    default:
      return `Message ${this.id} from ${this.source} to ${
        this.target
      } at ${this.timestamp.toLocaleTimeString()}: ${this.content}`
    }
  }

  /**
   * Returns a primitive object representation of the messageInput. No methods or non-primitive objects are used.
   * @return {Object} An object representation of the messageInput.
   */
  toObject() {
    return {
      ...this,
      type: this.type.toString().slice(7, -1),
      timestamp: this.timestamp.toISOString()
    }
  }
}