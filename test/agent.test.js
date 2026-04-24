import { vi, afterEach } from 'vitest'
import Agent from '../src/agent.js'

describe('Agent', () => {
  let agent
  let mockDriver
  let mockApi
  let mockIndex
  let mockConfig
  let messageHandlers

  beforeEach(() => {
    mockDriver = {
      type: 'testType',
      status: 'idle',
      instruct: vi.fn().mockResolvedValue('instruction result'),
      pause: vi.fn(),
      resume: vi.fn()
    }
    messageHandlers = {}
    mockApi = {
      log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      comms: {
        on: vi.fn((event, handler) => {
          messageHandlers[event] = handler
        }),
        emit: vi.fn(),
        history: { add: vi.fn() }
      },
      contextProviders: {
        validateAgentContexts: vi.fn(),
        enrich: vi.fn().mockResolvedValue(undefined)
      },
      emit: vi.fn()
    }
    mockIndex = {
      api: mockApi,
      getAgentDriver: vi.fn().mockReturnValue(mockDriver)
    }
    mockConfig = {
      type: 'testType',
      instructions: 'testInstructions',
      description: 'testDescription',
      driver: { type: 'testType' }
    }
    agent = new Agent(mockIndex, 'testAgent', mockConfig)
  })

  afterEach(() => {
    // Agent installs a setInterval; clear it so vitest can exit cleanly.
    if (agent && typeof agent.dispose === 'function') agent.dispose()
    vi.clearAllTimers()
  })

  describe('constructor', () => {
    it('should initialize with the correct name and driver', () => {
      expect(agent.name).toBe('testAgent')
      expect(agent.driver).toBe(mockDriver)
      expect(mockApi.contextProviders.validateAgentContexts).toHaveBeenCalledWith(
        'testAgent',
        undefined
      )
      expect(mockIndex.getAgentDriver).toHaveBeenCalledWith('testAgent', mockConfig)
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
      expect(agent.config).toEqual({ ...mockConfig, skills: [] })
    })
  })

  describe('messageInput event', () => {
    it('should call driver instruct method when a message event is received', async () => {
      const message = { source: 'user', target: 'testAgent', type: 'string', content: 'hi' }
      const handler = messageHandlers['testAgent']
      expect(handler).toBeTypeOf('function')
      await handler(message)
      expect(mockDriver.instruct).toHaveBeenCalledWith(message)
    })

    it('should propagate driver instruct rejection', async () => {
      const error = new Error('driver instruct error')
      mockDriver.instruct.mockRejectedValueOnce(error)
      const message = { source: 'user', target: 'testAgent', type: 'string', content: 'hi' }
      const handler = messageHandlers['testAgent']
      await expect(handler(message)).rejects.toThrow(error)
    })
  })
})
