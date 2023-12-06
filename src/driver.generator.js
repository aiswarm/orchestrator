/**
 * @typedef {Object} GeneratorConfig
 * @property {number} [interval=5000] The interval in milliseconds at which to send messages.
 * @property {string}  [to] The name of the agent to send messages to. Defaults to a random agent or group.
 * @property {string} [content] The content of the message to send. Defaults to a generic message with from/to info.
 */

export default class GeneratorDriver {
  #interval
  #config
  #api
  #agentName

  /**
   * Creates a new OpenAI driver.
   * @param {API} api The API object that allows to interact with the system.
   * @param {string} name The name of the agent for which this driver is running.
   * @param {AgentConfig} config The configuration object for this driver.
   */
  constructor({api, name, config}) {
    this.#api = api
    this.#agentName = name
    this.#config = config
    setTimeout(() => {
      this.resume()
    }, Math.random() * (this.#config.interval || 5000))
    api.log.debug('Created Generator driver for agent', name)
    api.log.trace('Generator driver config:', config)
  }

  /**
   * Returns the type of the driver which is 'openai'.
   * @override
   * @return {string}
   */
  get type() {
    return 'generator'
  }

  /**
   * Returns the configuration object for this driver.
   * @return {GeneratorConfig}
   */
  get config() {
    return this.#config
  }

  instruct(message) {
    const groupMessage = message.target !== this.#agentName
    this.#api.log.debug(
      groupMessage
        ? `Received group message for ${this.#agentName}:`
        : `Received message for ${this.#agentName}:`,
      message.toString()
    )
  }

  pause() {
    clearInterval(this.#interval)
  }

  resume() {
    clearInterval(this.#interval)
    this.#interval = setInterval(() => {
      const from = this.#agentName
      let to = this.#config.to
      if (!to) {
        const candidates = [
          ...this.#api.groups.list(),
          ...Object.keys(this.#api.agents.all()).filter(
              (name) => name !== from
          ),
        ]
        to = candidates[Math.floor(Math.random() * candidates.length)]
      }
      const content = `Message from ${from} to ${to}`
      const message = this.#api.comms.createMessage(to, from, content)
      this.#api.comms.emit(message)
      this.#api.log.info(message.toString())
    }, this.#config.interval || 5000)
  }
}
