import AgentDriver from '../src/agentDriver.js'
import AgentSkill from '../src/agentSkill.js'
import ContextProvider from '../src/contextProvider.js'
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
  class GoodProvider extends ContextProvider {
    get name() {
      return 'rag'
    }
    async contribute() {}
  }
  const goodProvider = () => new GoodProvider()

  it('accepts a well-formed provider', () => {
    expect(() => assertValidContextProvider(goodProvider())).not.toThrow()
  })

  it('treats dependsOn as optional (defaults to [])', () => {
    class NoDeps extends ContextProvider {
      get name() {
        return 'nodeps'
      }
      async contribute() {}
    }
    expect(() => assertValidContextProvider(new NoDeps())).not.toThrow()
  })

  it('rejects non-instances', () => {
    expect(() => assertValidContextProvider(null)).toThrow(/extends ContextProvider/)
    expect(() => assertValidContextProvider('rag')).toThrow(/extends ContextProvider/)
    expect(() =>
      assertValidContextProvider({ name: 'rag', dependsOn: [], contribute() {} })
    ).toThrow(/extends ContextProvider/)
  })

  it('rejects providers that do not override get name()', () => {
    class NoName extends ContextProvider {
      async contribute() {}
    }
    /* The abstract getter throws when accessed; assertValidContextProvider surfaces that. */
    expect(() => assertValidContextProvider(new NoName())).toThrow(/get name/)
  })

  it('rejects invalid name format', () => {
    class BadName extends ContextProvider {
      get name() {
        return 'RAG'
      }
      async contribute() {}
    }
    expect(() => assertValidContextProvider(new BadName())).toThrow(/lower-kebab-case/)
  })

  it('rejects non-array dependsOn', () => {
    class BadDeps extends ContextProvider {
      get name() {
        return 'rag'
      }
      get dependsOn() {
        return 'rag'
      }
      async contribute() {}
    }
    expect(() => assertValidContextProvider(new BadDeps())).toThrow(/invalid "dependsOn"/)
  })

  it('rejects non-string entries in dependsOn', () => {
    class BadDeps extends ContextProvider {
      get name() {
        return 'rag'
      }
      get dependsOn() {
        return ['valid', 42]
      }
      async contribute() {}
    }
    expect(() => assertValidContextProvider(new BadDeps())).toThrow(/invalid entry in "dependsOn"/)
  })

  it('rejects providers that do not override contribute', () => {
    class NoContribute extends ContextProvider {
      get name() {
        return 'rag'
      }
    }
    expect(() => assertValidContextProvider(new NoContribute())).toThrow(/abstract "contribute"/)
  })

  it('rejects duplicate names', () => {
    expect(() => assertValidContextProvider(goodProvider(), ['rag'])).toThrow(/already registered/)
  })
})
