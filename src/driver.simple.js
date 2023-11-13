/**
 * @typedef {import('./api').DriverConfig} SimpleConfig
 * @property {string} response The response to send to every prompt.
 */

/**
 * This is the driver for the OpenAI API.
 * @implements {Driver}
 */
class OpenAIDriver {
    #config;

    /**
     * Creates a new OpenAI driver.
     * @param {SimpleConfig} config
     */
    constructor(config) {
        this.#config = config
    }

    /**
     * Returns the type of the driver which is 'openai'.
     * @override
     * @return {string}
     */
    get type() {
        return 'simple'
    }

    /**
     * Sends a prompt to the driver and returns a response.
     * @param {string} prompt
     * @return {Promise<string>}
     */
    async instruct(prompt) {
        return 'Prompt: ' + prompt + '\nResponse: ' + this.#config.response
    }
}
