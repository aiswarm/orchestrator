import { vi } from 'vitest'
import Message from '../src/message.js'

describe('Message', () => {
  let api

  beforeEach(() => {
    api = {
      log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      emit: vi.fn()
    }
  })

  describe('append', () => {
    it('should emit messageAppended with the delta and update content', () => {
      const msg = new Message(api, 'agent', 'user', 'hello')
      msg.append(' world')
      expect(msg.content).toBe('hello world')
      expect(api.emit).toHaveBeenCalledWith('messageAppended', msg, ' world')
    })

    it('should not emit messageUpdated on append', () => {
      const msg = new Message(api, 'agent', 'user', 'hello')
      msg.append(' world')
      expect(api.emit).not.toHaveBeenCalledWith('messageUpdated', expect.anything())
    })

    it('should ignore empty appends', () => {
      const msg = new Message(api, 'agent', 'user', 'hello')
      msg.append('')
      expect(msg.content).toBe('hello')
      expect(api.emit).not.toHaveBeenCalled()
    })
  })

  describe('status setter', () => {
    it('should emit messageUpdated when the status changes', () => {
      const msg = new Message(api, 'agent', 'user', 'hi')
      msg.status = Message.state.processing
      expect(api.emit).toHaveBeenCalledWith('messageUpdated', msg)
    })

    it('should not emit on duplicate status writes', () => {
      const msg = new Message(
        api,
        'agent',
        'user',
        'hi',
        Message.type.string,
        Message.state.processing
      )
      api.emit.mockClear()
      msg.status = Message.state.processing
      expect(api.emit).not.toHaveBeenCalled()
    })
  })
})
