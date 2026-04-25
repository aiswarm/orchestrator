import { describe, it, expect, vi } from 'vitest'
import AgentDriver from '../src/agentDriver.js'

describe('AgentDriver base', () => {
  class TestDriver extends AgentDriver {
    static type = 'test-driver'
    async instruct() {}
  }

  it('exposes a default capabilities object', () => {
    const d = new TestDriver()
    expect(d.capabilities).toEqual({})
  })

  it('starts in the "created" status', () => {
    const d = new TestDriver()
    expect(d.status).toBe('created')
  })

  it('emits statusChanged when status is assigned a new value', () => {
    const d = new TestDriver()
    const handler = vi.fn()
    d.on('statusChanged', handler)
    d.status = 'idle'
    expect(d.status).toBe('idle')
    expect(handler).toHaveBeenCalledWith('idle')
  })

  it('does not emit when status is assigned its current value', () => {
    const d = new TestDriver()
    d.status = 'idle'
    const handler = vi.fn()
    d.on('statusChanged', handler)
    d.status = 'idle'
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses direct instantiation of the base class', () => {
    expect(() => new AgentDriver()).toThrow(/abstract/)
  })

  it('refuses subclasses without a static type', () => {
    class NoType extends AgentDriver {
      async instruct() {}
    }
    expect(() => new NoType()).toThrow(/static type/)
  })
})
