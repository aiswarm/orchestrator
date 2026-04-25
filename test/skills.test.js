import { describe, it, expect, vi, beforeEach } from 'vitest'
import Skills from '../src/skills.js'
import AgentSkill from '../src/agentSkill.js'

class FakeSkill extends AgentSkill {
  get name() {
    return 'fake'
  }
  get description() {
    return 'fake skill'
  }
  async execute(args, agentName) {
    return { args, agentName }
  }
}

describe('Skills.invoke', () => {
  let skills
  let api

  beforeEach(() => {
    api = {
      log: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      comms: {
        createMessage: vi.fn().mockReturnValue({}),
        emit: vi.fn()
      }
    }
    skills = new Skills(api)
    skills.add(FakeSkill)
  })

  it('runs a registered skill via invoke({agentName, name, args})', async () => {
    const result = await skills.invoke({ agentName: 'A1', name: 'fake', args: { x: 1 } })
    expect(result).toEqual({ args: { x: 1 }, agentName: 'A1' })
  })

  it('defaults args to {} when omitted', async () => {
    const result = await skills.invoke({ agentName: 'A1', name: 'fake' })
    expect(result).toEqual({ args: {}, agentName: 'A1' })
  })

  it('throws when the skill is not registered', async () => {
    await expect(skills.invoke({ agentName: 'A1', name: 'nope' })).rejects.toThrow(/not found/)
  })
})
