/**
 * This is the default configuration file for the app.
 * @class Config
 * @type {{global: {driver: {max_tokens: number, temperature: number, flags: {analyze: boolean, generate: boolean, browse: boolean}, model: string, type: string}}}}
 */
const config = {
    global: {
        driver: {
            type: 'openai',
            model: "gpt-4-turbo",
            temperature: 0.9,
            max_tokens: 100,
            flags: {
                browse: true,
                generate: true,
                analyze: true
            }
        }
    }
}
export default config;