import AgentDriver from '../agentDriver.js'
import AgentSkill from '../agentSkill.js'
import {
  assertValidDriver,
  assertValidSkill,
  assertValidSkillClass,
  assertValidContextProvider
} from '../src/validators.js'

describe('assertValidDriver', () => {
  class GoodDriver extends AgentDriver {
    static type = 'good'
    async instruct() {}
  }

  it('accepts a well-formed driver class', () => {
    expect(() => assertValidDriver(GoodDriver)).not.toThrow()
  })

  it('rejects non-functions', () => {
    expect(() => assertValidDriver({})).toThrow(/expects a class/)
    expect(() => assertValidDriver(null)).toThrow(/expects a class/)
    expect(() => assertValidDriver('OpenAIDriver')).toThrow(/expects a class/)
  })

  it('rejects classes that do not extend AgentDriver', () => {
    class DuckDriver {
      static type = 'duck'
      async instruct() {}
      pause() {}
      resume() {}
    }
    expect(() => assertValidDriver(DuckDriver)).toThrow(/must extend AgentDriver/)
  })

  it('rejects the abstract base class itself', () => {
    expect(() => assertValidDriver(AgentDriver)).toThrow(/must extend AgentDriver/)
  })

  it('rejects a subclass missing static type', () => {
    class NoType extends AgentDriver {
      async instruct() {}
    }
    expect(() => assertValidDriver(NoType)).toThrow(/static type/)
  })

  it('rejects a subclass with an invalid type format', () => {
    class CamelType extends AgentDriver {
      static type = 'OpenAI'
      async instruct() {}
    }
    expect(() => assertValidDriver(CamelType)).toThrow(/lower-kebab-case/)
  })

  it('rejects a subclass that does not override instruct', () => {
    class NoInstruct extends AgentDriver {
      static type = 'no-instruct'
    }
    expect(() => assertValidDriver(NoInstruct)).toThrow(/must override the abstract "instruct"/)
  })

  it('rejects duplicate type registrations', () => {
    expect(() => assertValidDriver(GoodDriver, ['good'])).toThrow(/already registered/)
  })
})

describe('assertValidSkillClass', () => {
  class GoodSkill extends AgentSkill {
    get name() {
      return 'good_skill'
    }
    get description() {
      return 'does a thing'
    }
    execute() {}
  }

  it('accepts a class that extends AgentSkill', () => {
    expect(() => assertValidSkillClass(GoodSkill)).not.toThrow()
  })

  it('rejects non-functions', () => {
    expect(() => assertValidSkillClass({})).toThrow(/expects a class/)
    expect(() => assertValidSkillClass(null)).toThrow(/expects a class/)
  })

  it('rejects classes that do not extend AgentSkill', () => {
    class DuckSkill {
      get name() {
        return 'duck'
      }
      get description() {
        return 'duck'
      }
      execute() {}
    }
    expect(() => assertValidSkillClass(DuckSkill)).toThrow(/must extend AgentSkill/)
  })

  it('rejects the abstract base class itself', () => {
    expect(() => assertValidSkillClass(AgentSkill)).toThrow(/must extend AgentSkill/)
  })
})

describe('assertValidSkill', () => {
  class GoodSkill extends AgentSkill {
    get name() {
      return 'my_skill'
    }
    get description() {
      return 'does a thing'
    }
    execute() {}
  }

  it('accepts a well-formed skill instance', () => {
    expect(() => assertValidSkill(new GoodSkill(), 'GoodSkill')).not.toThrow()
  })

  it('rejects instances that do not extend AgentSkill', () => {
    const ducklike = {
      name: 'duck',
      description: 'duck',
      execute() {}
    }
    expect(() => assertValidSkill(ducklike, 'Duck')).toThrow(/must extend AgentSkill/)
  })

  it('rejects a subclass that did not override get name()', () => {
    class NoName extends AgentSkill {
      get description() {
        return 'd'
      }
      execute() {}
    }
    /*
     * Construction succeeds (the abstract throw only fires when name is read).
     * Building the instance and reading name throws — guard the assertion.
     */
    expect(() => assertValidSkill(new NoName(), 'NoName')).toThrow()
  })

  it('rejects a subclass that did not override get description()', () => {
    class NoDescription extends AgentSkill {
      get name() {
        return 'n'
      }
      execute() {}
    }
    expect(() => assertValidSkill(new NoDescription(), 'NoDescription')).toThrow()
  })

  it('rejects a subclass that did not override execute', () => {
    class NoExecute extends AgentSkill {
      get name() {
        return 'noex'
      }
      get description() {
        return 'd'
      }
    }
    expect(() => assertValidSkill(new NoExecute(), 'NoExecute')).toThrow(
      /must override the abstract "execute"/
    )
  })

  it('rejects duplicate skill names', () => {
    expect(() => assertValidSkill(new GoodSkill(), 'GoodSkill', ['my_skill'])).toThrow(
      /already registered/
    )
  })

  it('rejects skill names that are not lower-snake-case', () => {
    class KebabSkill extends AgentSkill {
      get name() {
        return 'create-agent'
      }
      get description() {
        return 'd'
      }
      execute() {}
    }
    expect(() => assertValidSkill(new KebabSkill(), 'KebabSkill')).toThrow(/lower-snake-case/)
  })
})

describe('assertValidContextProvider', () => {
  const goodProvider = () => ({
    name: 'rag',
    dependsOn: [],
    contribute: async () => ({})
  })

  it('accepts a well-formed provider', () => {
    expect(() => assertValidContextProvider(goodProvider())).not.toThrow()
  })

  it('treats dependsOn as optional', () => {
    const p = goodProvider()
    delete p.dependsOn
    expect(() => assertValidContextProvider(p)).not.toThrow()
  })

  it('rejects non-objects', () => {
    expect(() => assertValidContextProvider(null)).toThrow(/expects a provider/)
    expect(() => assertValidContextProvider('rag')).toThrow(/expects a provider/)
  })

  it('rejects missing name', () => {
    const p = goodProvider()
    delete p.name
    expect(() => assertValidContextProvider(p)).toThrow(/missing required "name"/)
  })

  it('rejects invalid name format', () => {
    const p = goodProvider()
    p.name = 'RAG'
    expect(() => assertValidContextProvider(p)).toThrow(/lower-kebab-case/)
  })

  it('rejects non-array dependsOn', () => {
    const p = goodProvider()
    p.dependsOn = 'rag'
    expect(() => assertValidContextProvider(p)).toThrow(/invalid "dependsOn"/)
  })

  it('rejects non-string entries in dependsOn', () => {
    const p = goodProvider()
    p.dependsOn = ['valid', 42]
    expect(() => assertValidContextProvider(p)).toThrow(/invalid entry in "dependsOn"/)
  })

  it('rejects missing contribute method', () => {
    const p = goodProvider()
    delete p.contribute
    expect(() => assertValidContextProvider(p)).toThrow(/missing required "contribute"/)
  })

  it('rejects duplicate names', () => {
    expect(() => assertValidContextProvider(goodProvider(), ['rag'])).toThrow(/already registered/)
  })
})
