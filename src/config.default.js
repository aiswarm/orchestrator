/**
 * This is the default configuration file for the app.
 * @class Config
 */
const config = {
  global: {
    agents: {
      driver: {
        type: 'openai',
      },
    },
  },
  comms: {
    history: {
      limits: {
        all: 100_000,
        individual: 10_000,
      },
    },
  },
  drivers: {
    openai: {
      engine: 'gpt-4-turbo',
      maxTokens: 1500,
      temperature: 0.9,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0,
      bestOf: 1,
      n: 1,
      flags: {
        browse: true,
        generate: true,
        analyze: true,
      },
    },
  },
  agents: {},
}
export default config
