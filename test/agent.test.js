import Agent from '../src/agent.js'
import { jest } from '@jest/globals'

describe('Agent', () => {
  let agent
  let mockDriver
  let mockApi
  let mockConfig

  beforeEach(() => {
    mockDriver = {
      instruct: jest.fn().mockResolvedValue('instruction result'),
    }
    mockApi = {
      comms: {
        on: jest.fn(),
      },
    }
    mockConfig = {
      type: 'testType',
      instructions: 'testInstructions',
      description: 'testDescription',
      creator: false,
      isolate: false,
      driver: mockDriver,
    }
    agent = new Agent(mockApi, 'testAgent', mockConfig, mockDriver)
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with the correct name and driver', () => {
      expect(agent.name).toBe('testAgent')
      expect(agent.driver).toBe(mockDriver)
    })
  })

  describe('name', () => {
    it('should return the correct name', () => {
      expect(agent.name).toBe('testAgent')
    })
  })

  describe('driver', () => {
    it('should return the correct driver', () => {
      expect(agent.driver).toBe(mockDriver)
    })
  })

  describe('config', () => {
    it('should return the correct config', () => {
      expect(agent.config).toEqual(mockConfig)
    })
  })

  describe('instruct', () => {
    it('should call the driver instruct method with the correct prompt', async () => {
      const prompt = 'test prompt'
      const result = await agent.instruct(prompt)
      expect(mockDriver.instruct).toHaveBeenCalledWith('testAgent', prompt)
      expect(result).toBe('instruction result')
    })

    it('should handle driver instruct method rejection', async () => {
      const error = new Error('driver instruct error')
      mockDriver.instruct.mockRejectedValueOnce(error)
      await expect(agent.instruct('test prompt')).rejects.toThrow(error)
    })
  })

  describe('message event', () => {
    it('should call driver instruct method when a message event is received', () => {
      const message = 'test message'
      mockApi.comms.on.mockImplementation((event, callback) => {
        if (event === 'testAgent') {
          callback(message)
        }
      })
      new Agent(mockApi, 'testAgent', mockConfig, mockDriver)
      expect(mockDriver.instruct).toHaveBeenCalledWith(message)
    })
  })
})
