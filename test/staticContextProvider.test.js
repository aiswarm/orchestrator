import StaticContextProvider from '../src/contextProvider.static.js'

const make = staticConfig =>
  new StaticContextProvider({
    api: { config: staticConfig === undefined ? {} : { contexts: { static: staticConfig } } }
  })

describe('StaticContextProvider', () => {
  it('exposes the kebab-case name "static"', () => {
    const p = make({ systemContext: 'hi' })
    expect(p.name).toBe('static')
    expect(p.dependsOn).toEqual([])
  })

  it('returns systemContext from the global contexts.static.systemContext', () => {
    const p = make({ systemContext: 'You are an expert in cryptography.' })
    expect(p.contribute()).toEqual({ systemContext: 'You are an expert in cryptography.' })
  })

  it('passes through `userContext` and `metadata`', () => {
    const p = make({
      systemContext: 'system text',
      userContext: 'mission briefing',
      metadata: { tag: 'mission' }
    })
    expect(p.contribute()).toEqual({
      systemContext: 'system text',
      userContext: 'mission briefing',
      metadata: { tag: 'mission' }
    })
  })

  it('returns a contribution with only the fields that were configured', () => {
    const p = make({ userContext: 'just text' })
    expect(p.contribute()).toEqual({ userContext: 'just text' })
  })

  it('returns undefined when no config is provided', () => {
    expect(make(undefined).contribute()).toBeUndefined()
    expect(make({}).contribute()).toBeUndefined()
  })

  it('returns undefined when systemContext is an empty string and nothing else is set', () => {
    expect(make({ systemContext: '' }).contribute()).toBeUndefined()
  })

  it('returns undefined when userContext is an empty string and nothing else is set', () => {
    expect(make({ userContext: '' }).contribute()).toBeUndefined()
  })

  it('throws on invalid systemContext type at construction time', () => {
    expect(() => make({ systemContext: 42 })).toThrow(/systemContext/)
  })

  it('throws on invalid userContext type at construction time', () => {
    expect(() => make({ systemContext: 'ok', userContext: 42 })).toThrow(/userContext/)
  })

  it('throws on invalid metadata type at construction time', () => {
    expect(() => make({ systemContext: 'ok', metadata: [1, 2, 3] })).toThrow(/metadata/)
  })

  it('returns the same contribution object on every call (cached)', () => {
    const p = make({ systemContext: 'cached' })
    expect(p.contribute()).toBe(p.contribute())
  })
})
