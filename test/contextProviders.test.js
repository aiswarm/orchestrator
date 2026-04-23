import ContextProviders from '../src/contextProviders.js'
import ContextProvider from '../src/contextProvider.js'

function fakeApi() {
  const events = []
  return {
    log: { info: () => {}, warn: () => {}, error: () => {}, trace: () => {}, debug: () => {} },
    emit: (...args) => events.push(args),
    once: () => {},
    on: () => {},
    events
  }
}

/**
 * Build a ContextProvider subclass instance from an options bag.
 * Lets the existing test bodies stay terse while satisfying the
 * `instanceof ContextProvider` requirement.
 * @param {{name?: string, dependsOn?: string[], contribute?: Function}} opts
 */
function makeProvider(opts = {}) {
  class P extends ContextProvider {
    get name() {
      return opts.name
    }
    get dependsOn() {
      return opts.dependsOn ?? []
    }
  }
  if (opts.contribute) P.prototype.contribute = opts.contribute
  return new P()
}

describe('ContextProviders', () => {
  describe('add() / get() / list()', () => {
    it('registers and retrieves a valid provider', () => {
      const cp = new ContextProviders(fakeApi())
      const provider = makeProvider({ name: 'rag', async contribute() {} })
      cp.add(provider)
      expect(cp.get('rag')).toBe(provider)
      expect(cp.list()).toEqual([{ name: 'rag', dependsOn: [] }])
    })

    it('rejects a duplicate name', () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(makeProvider({ name: 'rag', async contribute() {} }))
      expect(() => cp.add(makeProvider({ name: 'rag', async contribute() {} }))).toThrow(
        /already registered/
      )
    })

    it('rejects a structurally invalid provider', () => {
      const cp = new ContextProviders(fakeApi())
      expect(() => cp.add(makeProvider({ name: 'BadName', async contribute() {} }))).toThrow(
        /kebab/i
      )
      expect(() => cp.add(makeProvider({ name: 'rag' }))).toThrow(/contribute/)
    })
  })

  describe('validateAgentContexts()', () => {
    it('throws on an unknown name with a clear message', () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(makeProvider({ name: 'rag', async contribute() {} }))
      expect(() => cp.validateAgentContexts('Researcher', ['rag', 'memory'])).toThrow(
        /Researcher.*memory.*no such provider/
      )
    })

    it('is a no-op when the agent has no context list', () => {
      const cp = new ContextProviders(fakeApi())
      expect(() => cp.validateAgentContexts('A', undefined)).not.toThrow()
      expect(() => cp.validateAgentContexts('A', [])).not.toThrow()
    })
  })

  describe('enrich()', () => {
    it('returns undefined when the agent has no context list', async () => {
      const cp = new ContextProviders(fakeApi())
      const result = await cp.enrich({
        agent: { name: 'A', config: {} },
        incomingMessage: { content: 'hi' }
      })
      expect(result).toBeUndefined()
    })

    it('runs a single provider and assembles entries', async () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(
        makeProvider({
          name: 'rag',
          async contribute() {
            return { systemContext: 'rag-text', metadata: { hits: 3 } }
          }
        })
      )
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['rag'] } },
        incomingMessage: { content: 'hi' }
      })
      expect(result).toEqual({
        entries: [{ name: 'rag', systemContext: 'rag-text', metadata: { hits: 3 } }]
      })
    })

    it('runs layers in dependency order, parallel within a layer', async () => {
      const cp = new ContextProviders(fakeApi())
      const order = []
      let ragSeenByMemory
      cp.add(
        makeProvider({
          name: 'rag',
          async contribute() {
            await new Promise(r => setTimeout(r, 20))
            order.push('rag')
            return { metadata: { sources: ['a'] } }
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'workspace',
          async contribute() {
            order.push('workspace')
            return { systemContext: 'ws' }
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'memory',
          dependsOn: ['rag'],
          async contribute({ contributions }) {
            ragSeenByMemory = contributions.get('rag')
            order.push('memory')
            return { systemContext: 'mem' }
          }
        })
      )
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['rag', 'memory', 'workspace'] } },
        incomingMessage: { content: 'hi' }
      })
      // workspace runs in L0 with rag (parallel); memory waits for rag
      expect(order.indexOf('memory')).toBeGreaterThan(order.indexOf('rag'))
      expect(ragSeenByMemory).toEqual({ metadata: { sources: ['a'] } })
      // entries: L0 in agentContext order (rag, workspace), then L1 (memory)
      expect(result.entries.map(e => e.name)).toEqual(['rag', 'workspace', 'memory'])
    })

    it('captures a thrown provider as an error entry and emits contextProviderError', async () => {
      const api = fakeApi()
      const cp = new ContextProviders(api)
      cp.add(
        makeProvider({
          name: 'rag',
          async contribute() {
            throw new Error('boom')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'memory',
          dependsOn: ['rag'],
          async contribute({ contributions }) {
            return { metadata: { sawRagError: contributions.get('rag')?.error === true } }
          }
        })
      )
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['rag', 'memory'] } },
        incomingMessage: { content: 'hi' }
      })
      expect(result.entries[0]).toMatchObject({ name: 'rag', error: true, errorMessage: 'boom' })
      expect(result.entries[1].metadata.sawRagError).toBe(true)
      expect(api.events.some(e => e[0] === 'contextProviderError')).toBe(true)
    })

    it('detects dependency cycles', async () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(makeProvider({ name: 'a', dependsOn: ['b'], async contribute() {} }))
      cp.add(makeProvider({ name: 'b', dependsOn: ['a'], async contribute() {} }))
      await expect(
        cp.enrich({
          agent: { name: 'A', config: { contexts: ['a', 'b'] } },
          incomingMessage: {}
        })
      ).rejects.toThrow(/cycle/i)
    })

    it('drops a contribution when the provider returns undefined', async () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(
        makeProvider({
          name: 'rag',
          async contribute() {}
        })
      )
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['rag'] } },
        incomingMessage: {}
      })
      expect(result.entries).toEqual([])
    })

    it('records an error entry when contribute() returns a non-object', async () => {
      const api = fakeApi()
      const cp = new ContextProviders(api)
      cp.add(
        makeProvider({
          name: 'rag',
          async contribute() {
            return 'not an object'
          }
        })
      )
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['rag'] } },
        incomingMessage: {}
      })
      expect(result.entries[0]).toMatchObject({ name: 'rag', error: true })
      expect(result.entries[0].errorMessage).toMatch(/expected a Contribution object/)
      expect(api.events.some(e => e[0] === 'contextProviderError')).toBe(true)
    })

    it('records an error entry when a Contribution field has the wrong type', async () => {
      const api = fakeApi()
      const cp = new ContextProviders(api)
      cp.add(
        makeProvider({
          name: 'rag',
          async contribute() {
            return { systemContext: 42 }
          }
        })
      )
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['rag'] } },
        incomingMessage: {}
      })
      expect(result.entries[0]).toMatchObject({ name: 'rag', error: true })
      expect(result.entries[0].errorMessage).toMatch(/systemContext.*string/)
    })
  })

  describe('dependency layering (via enrich())', () => {
    /*
     * The #computeLayers while-loop must terminate on every input shape. Each
     * iteration either removes ≥1 provider from `remaining` or throws a cycle
     * error; these tests guard that invariant against the easy-to-introduce
     * regression of an infinite loop.
     */

    it('processes a deep linear chain in N sequential layers', async () => {
      const cp = new ContextProviders(fakeApi())
      const order = []
      cp.add(
        makeProvider({
          name: 'a',
          async contribute() {
            order.push('a')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'b',
          dependsOn: ['a'],
          async contribute() {
            order.push('b')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'c',
          dependsOn: ['b'],
          async contribute() {
            order.push('c')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'd',
          dependsOn: ['c'],
          async contribute() {
            order.push('d')
          }
        })
      )
      const start = Date.now()
      await cp.enrich({
        agent: { name: 'A', config: { contexts: ['a', 'b', 'c', 'd'] } },
        incomingMessage: {}
      })
      expect(order).toEqual(['a', 'b', 'c', 'd'])
      // Sanity bound — a degenerate loop would not return in this window.
      expect(Date.now() - start).toBeLessThan(1000)
    })

    it('parallelizes a diamond shape into three layers', async () => {
      const cp = new ContextProviders(fakeApi())
      const order = []
      cp.add(
        makeProvider({
          name: 'top',
          async contribute() {
            order.push('top')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'left',
          dependsOn: ['top'],
          async contribute() {
            order.push('left')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'right',
          dependsOn: ['top'],
          async contribute() {
            order.push('right')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'bottom',
          dependsOn: ['left', 'right'],
          async contribute() {
            order.push('bottom')
          }
        })
      )
      await cp.enrich({
        agent: { name: 'A', config: { contexts: ['top', 'left', 'right', 'bottom'] } },
        incomingMessage: {}
      })
      expect(order[0]).toBe('top')
      expect(order[3]).toBe('bottom')
      expect(new Set([order[1], order[2]])).toEqual(new Set(['left', 'right']))
    })

    it('detects a self-cycle (provider depends on itself)', async () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(makeProvider({ name: 'a', dependsOn: ['a'], async contribute() {} }))
      await expect(
        cp.enrich({
          agent: { name: 'A', config: { contexts: ['a'] } },
          incomingMessage: {}
        })
      ).rejects.toThrow(/cycle/i)
    })

    it('detects a 3-node cycle and names the involved providers', async () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(makeProvider({ name: 'a', dependsOn: ['b'], async contribute() {} }))
      cp.add(makeProvider({ name: 'b', dependsOn: ['c'], async contribute() {} }))
      cp.add(makeProvider({ name: 'c', dependsOn: ['a'], async contribute() {} }))
      await expect(
        cp.enrich({
          agent: { name: 'A', config: { contexts: ['a', 'b', 'c'] } },
          incomingMessage: {}
        })
      ).rejects.toThrow(/cycle.*a, b, c|cycle.*b, c, a|cycle.*c, a, b/i)
    })

    it('detects a cycle even when an independent provider is also opted in', async () => {
      const cp = new ContextProviders(fakeApi())
      cp.add(makeProvider({ name: 'good', async contribute() {} }))
      cp.add(makeProvider({ name: 'a', dependsOn: ['b'], async contribute() {} }))
      cp.add(makeProvider({ name: 'b', dependsOn: ['a'], async contribute() {} }))
      await expect(
        cp.enrich({
          agent: { name: 'A', config: { contexts: ['good', 'a', 'b'] } },
          incomingMessage: {}
        })
      ).rejects.toThrow(/cycle.*a, b|cycle.*b, a/i)
    })

    it('drops edges to providers the agent did not opt into and runs the dependent', async () => {
      const infos = []
      const api = fakeApi()
      api.log.info = (...args) => infos.push(args.join(' '))
      const cp = new ContextProviders(api)
      const order = []
      cp.add(
        makeProvider({
          name: 'rag',
          async contribute() {
            order.push('rag')
          }
        })
      )
      cp.add(
        makeProvider({
          name: 'memory',
          dependsOn: ['rag'],
          async contribute() {
            order.push('memory')
            return { systemContext: 'm' }
          }
        })
      )
      // Agent opts into memory only; rag is registered but not in the agent's set.
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['memory'] } },
        incomingMessage: {}
      })
      expect(order).toEqual(['memory'])
      expect(result.entries.map(e => e.name)).toEqual(['memory'])
      expect(infos.some(m => /memory.*depends on "rag".*did not opt into/.test(m))).toBe(true)
    })

    it('drops edges to providers that are not registered at all', async () => {
      const infos = []
      const api = fakeApi()
      api.log.info = (...args) => infos.push(args.join(' '))
      const cp = new ContextProviders(api)
      cp.add(
        makeProvider({
          name: 'memory',
          dependsOn: ['nope'],
          async contribute() {
            return { systemContext: 'm' }
          }
        })
      )
      const result = await cp.enrich({
        agent: { name: 'A', config: { contexts: ['memory'] } },
        incomingMessage: {}
      })
      expect(result.entries.map(e => e.name)).toEqual(['memory'])
      expect(infos.some(m => /memory.*depends on "nope".*not registered/.test(m))).toBe(true)
    })
  })
})
