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
      groups: {
        get: vi.fn().mockReturnValue(undefined)
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

    it('should reply directly to the sender when the message was a direct message', async () => {
      const message = { source: 'user', target: 'testAgent', type: 'string', content: 'hi' }
      mockDriver.instruct.mockResolvedValueOnce('hello back')
      const handler = messageHandlers['testAgent']
      await handler(message)
      expect(mockApi.comms.emit).toHaveBeenCalledWith('user', 'testAgent', 'hello back')
    })

    it('should reply to the group when the original message was addressed to a group', async () => {
      mockApi.groups.get.mockImplementation(name =>
        name === 'team1' ? ['testAgent', 'user'] : undefined
      )
      const message = { source: 'user', target: 'team1', type: 'string', content: 'hi team' }
      mockDriver.instruct.mockResolvedValueOnce('hello team')
      const handler = messageHandlers['testAgent']
      await handler(message)
      expect(mockApi.comms.emit).toHaveBeenCalledWith('team1', 'testAgent', 'hello team')
    })
  })

  describe('status propagation', () => {
    it('should mirror the initial driver status', () => {
      expect(agent.status).toBe('idle')
    })

    it('should update status and emit agentUpdated when the driver fires statusChanged', () => {
      const driverHandlers = {}
      const eventDriver = {
        type: 'eventy',
        status: 'created',
        on: vi.fn((event, fn) => {
          driverHandlers[event] = fn
        }),
        instruct: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn()
      }
      mockIndex.getAgentDriver.mockReturnValueOnce(eventDriver)
      const eventAgent = new Agent(mockIndex, 'eventAgent', mockConfig)
      mockApi.emit.mockClear()

      eventDriver.status = 'busy'
      driverHandlers.statusChanged('busy')

      expect(eventAgent.status).toBe('busy')
      expect(mockApi.emit).toHaveBeenCalledWith('agentUpdated', eventAgent)
    })

    /*
     * Dedupe is the driver's responsibility (see AgentDriver.set status).
     * Agent simply forwards every statusChanged event it receives.
     */
    it('should re-emit agentUpdated for every statusChanged the driver fires', () => {
      const driverHandlers = {}
      const eventDriver = {
        type: 'eventy',
        status: 'idle',
        on: vi.fn((event, fn) => {
          driverHandlers[event] = fn
        }),
        instruct: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn()
      }
      mockIndex.getAgentDriver.mockReturnValueOnce(eventDriver)
      const dup = new Agent(mockIndex, 'dup', mockConfig)
      mockApi.emit.mockClear()

      driverHandlers.statusChanged('idle')

      expect(mockApi.emit).toHaveBeenCalledWith('agentUpdated', dup)
    })
  })
})
