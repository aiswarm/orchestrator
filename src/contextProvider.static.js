import ContextProvider from './contextProvider.js'
import { assertValidContribution } from './validators.js'

/**
 * Built-in context provider that injects a single, globally-configured
 * contribution into every agent that opts in. Companion to the built-in
 * `generator` driver and built-in skills (see src/index.js for registration).
 *
 * Configuration follows the same shape as built-in skills: the contribution
 * lives in the global config under `contexts.static` (mirroring
 * `skills.{name}` and `drivers.{type}`). Agents opt in by listing `'static'`
 * in their `contexts` array — they carry no provider config of their own.
 *
 * Fields pass straight through to {@link Contribution}:
 *
 * - `systemContext` — text prepended to the system prompt.
 * - `userContext` — text prepended to the user message.
 * - `metadata` — plain object exposed to providers in later layers.
 *
 * ```js
 * contexts: {
 *   static: {
 *     systemContext: 'You are part of an autonomous agent swarm.',
 *     userContext: 'Mission: refactor auth.',
 *     metadata: { tag: 'mission-control' }
 *   }
 * }
 *
 * // Per agent (just the opt-in):
 * agents: {
 *   Researcher: { contexts: ['static'] }
 * }
 * ```
 *
 * Validation runs once at construction time (config is not observed for
 * runtime updates — same pattern as built-in skills/drivers). When the
 * resulting contribution is empty, `contribute()` permanently returns
 * `undefined`, so the provider is harmless to leave registered with no
 * config.
 */
export default class StaticContextProvider extends ContextProvider {
  #contribution

  constructor({ api }) {
    super()
    const config = api.config.contexts?.static ?? {}
    this.#contribution = this.#buildContribution(config)
  }

  get name() {
    return 'static'
  }

  contribute() {
    return this.#contribution
  }

  #buildContribution(config) {
    const { systemContext, userContext, metadata } = config
    const contribution = {}
    if (systemContext !== undefined && systemContext !== '') {
      contribution.systemContext = systemContext
    }
    if (userContext !== undefined && userContext !== '') {
      contribution.userContext = userContext
    }
    if (metadata !== undefined) {
      contribution.metadata = metadata
    }
    if (Object.keys(contribution).length === 0) return undefined
    assertValidContribution(this.name, contribution)
    return contribution
  }
}
