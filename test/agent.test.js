import { vi } from 'vitest'
import Agent from '../src/agent.js'

describe('Agent', () => {
  let agent
  let mockDriver
  let mockApi
  let mockConfig

  beforeEach(() => {
    mockDriver = {
      instruct: vi.fn().mockResolvedValue('instruction result')
    }
    mockApi = {
      comms: {
        on: vi.fn(),
        emit: vi.fn()
      }
    }
    mockConfig = {
      type: 'testType',
      instructions: 'testInstructions',
      description: 'testDescription',
      creator: false,
      isolate: false,
      driver: mockDriver
    }
    agent = new Agent(mockApi, 'testAgent', mockConfig, mockDriver)
    vi.clearAllMocks()
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
      expect(mockDriver.instruct).toHaveBeenCalledWith(prompt)
      expect(result).toBe('instruction result')
    })

    it('should handle driver instruct method rejection', async () => {
      const error = new Error('driver instruct error')
      mockDriver.instruct.mockRejectedValueOnce(error)
      await expect(agent.instruct('test prompt')).rejects.toThrow(error)
    })
  })

  describe('messageInput event', () => {
    it('should call driver instruct method when a messageInput event is received', () => {
      const message = 'test messageInput'
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
