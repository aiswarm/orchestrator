import On from 'onall'
import History from './history.js'

/**
 * This is mostly for documentation purposes, and make communication a little easier.
 */
class Message {
  static stringType = Symbol("string");
  static imageType = Symbol("image");
  static videoType = Symbol("video");
  static audioType = Symbol("audio");
  static #id = 1;

  constructor(target, source, content, type = Message.stringType) {
    this.id = Message.#id++;
    this.target = target;
    this.source = source;
    this.content = content;
    this.timestamp = new Date();
    if (typeof type === "string") {
      switch (type) {
        case "image":
          type = Message.imageType;
          break;
        case "video":
          type = Message.videoType;
          break;
        case "audio":
          type = Message.audioType;
          break;
        default:
          type = Message.stringType;
          break;
      }
    }
    this.type = type;
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
        } at ${this.timestamp.toLocaleTimeString()}`;
      case Message.videoType:
        return `Video ${this.id} from ${this.source} to ${
          this.target
        } at ${this.timestamp.toLocaleTimeString()}`;
      case Message.audioType:
        return `Audio ${this.id} from ${this.source} to ${
          this.target
        } at ${this.timestamp.toLocaleTimeString()}`;
      default:
        return `Message ${this.id} from ${this.source} to ${
          this.target
        } at ${this.timestamp.toLocaleTimeString()}: ${this.content}`;
    }
  }

  /**
   * Returns a primitive object representation of the messageInput. No methods or non-primitive objects are used.
   * @return {Object} An object representation of the messageInput.
   */
  toObject() {
    const obj = Object.assign({}, this);
    obj.type = obj.type.toString().slice(7, -1);
    obj.timestamp = this.timestamp.toISOString();
    return obj;
  }
}

/**
 * Handles all communications between the different agents, groups, and the user.
 * This class basically acts as an Event Emitter, but on top of that has a history and a catch-all for messages.
 */
export default class Communications extends On {
  static Message = Message;
  #history;
  #interval;

  constructor(api) {
    super();
    this.#history = new History(api);
  }

  get history() {
    return this.#history;
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
    const message =
      event instanceof Message
        ? event
        : event instanceof Object
        ? new Message(event.target, event.source, event.content, event.type)
        : new Message(event, args[0], args[1], args[2]);
    this.#history.add(message);
    if (message.target !== "all") {
      super.emit("all", message);
    }
    return super.emit(message.target, message);
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
    return new Message(target, source, content, type);
  }

  destroy() {
    clearInterval(this.#interval);
    delete this;
  }
}
