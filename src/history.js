/**
 * @todo Feature: Write history to disk in batches and read it back in on startup + infinite history.
 */
export default class History {
  /** @type {API} */
  #api
  /** @type {Message[]} */
  #all = []
  /** @type {Object<string, Message[]>} */
  #byTarget = {}
  /** @type {Object<string, Message[]>} */
  #bySource = {}
  /** @type {NodeJS.Timeout} */
  #interval

  /**
   * @param {API} api
   */
  constructor(api) {
    this.#api = api
    this.#cleanRunner()
  }

  /**
   * Starts the history cleaner, an interval that runs every second and removes old messages from the history.
   */
  #cleanRunner() {
    if (this.#interval) {
      clearInterval(this.#interval)
    }
    this.#interval = setInterval(() => {
      while (this.#all.length > this.#api.config.comms.history.limits.all) {
        this.#all.shift()
      }
      for (const entry in this.#byTarget) {
        while (
          this.#byTarget[entry].length >
          this.#api.config.comms.history.limits.individual
        ) {
          this.#byTarget[entry].shift()
        }
      }
      for (const entry in this.#bySource) {
        while (
          this.#bySource[entry].length >
          this.#api.config.comms.history.limits.individual
        ) {
          this.#bySource[entry].shift()
        }
      }
    }, 1000)
  }

  destroy() {
    clearInterval(this.#interval)
  }

  /**
   * Adds a messageInput to the history of map messages and the history of the source.
   * @param {Message} message The messageInput to add.
   */
  add(message) {
    this.#all.push(message)
    this.#byTarget[message.target] ??= []
    this.#byTarget[message.target].push(message)
    this.#bySource[message.source] ??= []
    this.#bySource[message.source].push(message)
  }

  /**
   *  Returns the last n messages from the history.
   * @param {number} [limit=10000] The number of messages to return.
   * @return {Communications.Message[]} The last n messages from the history.
   */
  all(limit = this.#api.config.comms.history.limits.all) {
    return this.#all.slice(-limit)
  }

  /**
   * Returns the last n messages sent to the target.
   * @param {string} target The target of the messages.
   * @param {number} [limit=10000] The number of messages to return.
   * @return {Message[] | undefined} The last n messages sent to the target or an empty array if the target has no history.
   */
  byTarget(target, limit = this.#api.config.comms.history.limits.individual) {
    return this.#byTarget[target]?.slice(-limit) ?? []
  }

  /**
   * Returns the last n messages sent by the source.
   * @param {string} source The source of the messages.
   * @param {number} [limit=10000] The number of messages to return
   * @return {Message[] | undefined} The last n messages sent by the source or an empty array  if the source has no history.
   */
  bySource(source, limit = this.#api.config.comms.history.limits.individual) {
    return this.#bySource[source]?.slice(-limit) ?? []
  }
}
