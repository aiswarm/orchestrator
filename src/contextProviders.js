import { assertValidContextProvider, assertValidContribution } from './validators.js'

/**
 * @typedef {Object} ContextEntry
 * @property {string} name The provider's name.
 * @property {string} [systemContext]
 * @property {string} [userContext]
 * @property {Object} [metadata]
 * @property {boolean} [error] Set to true when the provider threw during contribute().
 * @property {string} [errorMessage]
 */

/**
 * Registry and per-turn executor for context providers (see
 * doc/context-provider-contract.md and the {@link ContextProvider} base class).
 *
 * Providers are registered as singleton instances of {@link ContextProvider}
 * subclasses. Per turn, the kernel resolves an agent's `contexts: [...]`
 * opt-in list, computes dependency layers via topological sort, runs each
 * layer in parallel, and assembles the deterministic `entries` array on
 * `message.context`.
 */
export default class ContextProviders {
  /** @type {API} */
  #api
  /** @type {Map<string, ContextProvider>} */
  #providers = new Map()

  /**
   * @param {API} api
   */
  constructor(api) {
    this.#api = api
  }

  /**
   * Register a context provider singleton. Validates against the contract.
   * @param {ContextProvider} provider
   * @throws {TypeError} If the provider fails {@link assertValidContextProvider}.
   * @throws {Error} If another provider is already registered with the same name.
   */
  add(provider) {
    assertValidContextProvider(provider, [...this.#providers.keys()])
    this.#providers.set(provider.name, provider)
  }

  /**
   * @param {string} name
   * @return {Object|undefined}
   */
  get(name) {
    return this.#providers.get(name)
  }

  /**
   * @return {Array<{name: string, dependsOn: string[]}>}
   */
  list() {
    return [...this.#providers.values()].map(p => ({
      name: p.name,
      dependsOn: Array.isArray(p.dependsOn) ? [...p.dependsOn] : []
    }))
  }

  /**
   * Validate every name in `agentContexts` is registered. Called at agent
   * creation time so config typos surface as load-time errors per
   * doc/context-provider-contract.md §3.
   * @param {string} agentName
   * @param {string[]} agentContexts
   * @throws {Error} If any name is not registered.
   */
  validateAgentContexts(agentName, agentContexts) {
    if (!Array.isArray(agentContexts)) return
    for (const name of agentContexts) {
      if (!this.#providers.has(name)) {
        throw new Error(
          `Agent "${agentName}" lists context provider "${name}" but no such provider is registered. ` +
            `Did you install the corresponding plugin?`
        )
      }
    }
  }

  /**
   * Run the context-enrichment pipeline for one turn. Returns the assembled
   * `{ entries }` object that the agent loop sets on `message.context`.
   *
   * Providers in the agent's `contexts: [...]` list are grouped into
   * dependency layers (topological sort over `dependsOn`). Within a layer,
   * `contribute()` calls run in parallel; layers run sequentially.
   *
   * Failures inside a single provider are caught and recorded as an error
   * entry; the turn continues (see contract §5).
   *
   * @param {Object} args
   * @param {Agent} args.agent
   * @param {Message} args.incomingMessage
   * @return {Promise<{entries: ContextEntry[]}|undefined>} The enriched
   *   context, or `undefined` when the agent has no `context` list (no
   *   enrichment).
   */
  async enrich({ agent, incomingMessage }) {
    const agentContext = agent.config?.contexts
    if (!Array.isArray(agentContext) || agentContext.length === 0) {
      return undefined
    }

    const providers = agentContext.map(name => this.#providers.get(name))
    const layers = this.#computeLayers(providers, agentContext, agent.name)

    /** @type {Map<string, Object>} */
    const contributions = new Map()
    /** @type {Map<string, ContextEntry>} */
    const entryByName = new Map()

    for (const layer of layers) {
      const snapshot = new Map(contributions)
      await Promise.all(
        layer.map(async provider => {
          try {
            const result = await provider.contribute({
              agent,
              incomingMessage,
              contributions: snapshot
            })
            if (result == null) return
            assertValidContribution(provider.name, result)
            contributions.set(provider.name, result)
            entryByName.set(provider.name, { name: provider.name, ...result })
          } catch (error) {
            this.#api.log.error(
              `Context provider "${provider.name}" threw during contribute() for agent "${agent.name}":`,
              error
            )
            this.#api.emit('contextProviderError', {
              agent,
              providerName: provider.name,
              error
            })
            const errorEntry = { error: true, message: error.message }
            contributions.set(provider.name, errorEntry)
            entryByName.set(provider.name, {
              name: provider.name,
              error: true,
              errorMessage: error.message
            })
          }
        })
      )
    }

    /*
     * Deterministic entry order: by (layer asc, position in agent's contexts: [...] asc).
     * Iterating layers in order and, within each layer, in agentContext order
     * gives exactly that.
     */
    const entries = []
    for (const layer of layers) {
      const layerOrdered = [...layer].sort(
        (a, b) => agentContext.indexOf(a.name) - agentContext.indexOf(b.name)
      )
      for (const provider of layerOrdered) {
        const entry = entryByName.get(provider.name)
        if (entry) entries.push(entry)
      }
    }

    return { entries }
  }

  /**
   * Topological sort into parallelizable layers. Edges are drawn only between
   * providers in the agent's opted-in set; deps to providers outside the set
   * are silently dropped (contract §4.4).
   * @param {Object[]} providers
   * @param {string[]} agentContext
   * @param {string} agentName
   * @return {Object[][]}
   * @throws {Error} If a cycle is detected.
   */
  #computeLayers(providers, agentContext, agentName) {
    const inSet = new Set(agentContext)
    const remaining = new Map(providers.map(p => [p.name, p]))
    const remainingDeps = new Map(
      providers.map(p => [
        p.name,
        new Set((Array.isArray(p.dependsOn) ? p.dependsOn : []).filter(d => inSet.has(d)))
      ])
    )

    /*
     * Log advisory warnings about unsatisfied deps that fall outside the
     * agent's opted-in set (contract §4.4: missing deps are info, not errors).
     */
    for (const provider of providers) {
      const declared = Array.isArray(provider.dependsOn) ? provider.dependsOn : []
      for (const dep of declared) {
        if (!this.#providers.has(dep)) {
          this.#api.log.info(
            `Context provider "${provider.name}" depends on "${dep}" which is not registered — running without it.`
          )
        } else if (!inSet.has(dep)) {
          this.#api.log.info(
            `Context provider "${provider.name}" depends on "${dep}" but agent "${agentName}" did not opt into it — running without it.`
          )
        }
      }
    }

    const layers = []
    while (remaining.size > 0) {
      const ready = []
      for (const [name, provider] of remaining) {
        if (remainingDeps.get(name).size === 0) ready.push(provider)
      }
      if (ready.length === 0) {
        const cycle = [...remaining.keys()].join(', ')
        throw new Error(
          `Cycle detected in context-provider dependsOn graph for agent "${agentName}": ${cycle}.`
        )
      }
      layers.push(ready)
      for (const provider of ready) {
        remaining.delete(provider.name)
        for (const deps of remainingDeps.values()) {
          deps.delete(provider.name)
        }
      }
    }
    return layers
  }
}
