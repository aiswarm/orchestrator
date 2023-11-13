/**
 * This is the default configuration file for the app.
 * @class Config
 * @type {{global: {driver: {max_tokens: number, temperature: number, flags: {analyze: boolean, generate: boolean, browse: boolean}, model: string, type: string}}}}
 */
const config = {
    global: {
        driver: {
            type: 'openai',
            engine: "gpt-4-turbo",
            maxTokens: 150,
            temperature: 0.9,
            topP: 1,
            presencePenalty: 0,
            frequencyPenalty: 0,
            bestOf: 1,
            n: 1,
            flags: {
                browse: true,
                generate: true,
                analyze: true
            }
        }
    }
}
export default config;