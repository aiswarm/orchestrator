/**
 * This is the default configuration file for the app.
 * @class Config
 */
const config = {
  global: {
    agents: {
      driver: {
        type: 'generator'
      },
      groups: []
    }
  },
  comms: {
    history: {
      limits: {
        all: 100_000,
        individual: 10_000
      }
    }
  },
  drivers: {
    generator: {
      interval: 5000
    }
  },
  agents: {},
  groups: {}
}
export default config
