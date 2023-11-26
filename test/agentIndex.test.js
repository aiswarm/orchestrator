import AgentIndex from '../src/agentIndex.js'
import Agent from '../src/agent.js'
import {jest} from '@jest/globals'

// Add a driver to the agentIndex
class Driver {
  s

  constructor(api, name, config) {
    this.config = config
  }

  instruct(name, prompt) {}
}

describe('AgentIndex', () => {
  let api, agentIndex

  beforeEach(() => {
    api = {
      comms: {
        on: jest.fn(),
      },
      config: {
        agents: {
          agent1: {
            driver: {
              type: 'driver1',
            },
            entrypoint: true,
          },
        },
      },
      log: {
        info: jest.fn(),
        error: jest.fn(),
        trace: jest.fn(),
      },
    }
    agentIndex = new AgentIndex(api)
    agentIndex.registerDriver('driver1', Driver)
  })

  it('should add an instance of AgentIndex', () => {
    expect(agentIndex).toBeInstanceOf(AgentIndex)
  })

  it('should initialize agents correctly', () => {
    agentIndex.initialize()
    expect(api.log.info).toHaveBeenCalled()
    expect(agentIndex.get('agent1')).toBeInstanceOf(Agent)
  })

  it('should run agents with given instructions', async () => {
    agentIndex.initialize()
    await agentIndex.run('instructions')
    expect(api.log.info).toHaveBeenCalled()
  })

  it('should get, list all, list by driver, and list with entry points correctly', () => {
    agentIndex.initialize()
    expect(agentIndex.byDriver('nonExistentDriver')).toBeUndefined()
    expect(agentIndex.get('agent1')).toBeInstanceOf(Agent)
    expect(agentIndex.all()).toHaveProperty('agent1')
    expect(agentIndex.byDriver('driver1')).toEqual([expect.any(Agent)])
    expect(agentIndex.withEntryPoints()).toEqual([expect.any(Agent)])
  })

  it('should add an agent correctly', () => {
    agentIndex.registerDriver('driver1', Driver)

    const agent = agentIndex.create('agent1', { driver: { type: 'driver1' } })
    expect(agent).toBeInstanceOf(Agent)
    expect(agent.driver).toBeInstanceOf(Driver)
    expect(agent.driver.config).toEqual({ type: 'driver1' })
  })

  it('should register a driver and get an agent driver correctly', () => {
    class Driver {
      constructor(api, name, config) {}
    }

    agentIndex.registerDriver('driver1', Driver)

    const driver = agentIndex.getAgentDriver('agent1', { type: 'driver1' })
    expect(driver).toBeInstanceOf(Driver)
  })
})
