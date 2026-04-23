/**
 * @typedef {Object} ContextRequest
 * @description The argument passed to {@link ContextProvider#contribute} for
 *   one turn. Providers SHOULD destructure named fields rather than store the
 *   whole object.
 * @property {Agent} agent The agent the message is being delivered to. Use
 *   `agent.history` for comms history; `agent.config.skills` for the
 *   configured tool list.
 * @property {Message} incomingMessage The message about to be handed to the
 *   driver. Treat as read-only.
 * @property {Map<string, Contribution>} contributions Snapshot of what
 *   providers in strictly-earlier dependency layers contributed this turn.
 *   Keyed by provider name. Read-only.
 */

/**
 * @typedef {Object} Contribution
 * @description The shape returned from {@link ContextProvider#contribute}.
 *   Both context fields are plain strings and enrich the OUTGOING request
 *   before it reaches the model. The kernel concatenates `systemContext`
 *   across providers onto the system prompt; `userContext` is prepended to
 *   the outbound user message. Mirrors {@link Message}'s string-based
 *   `content` — if Message ever grows a multi-part shape, this typedef
 *   should grow with it.
 * @property {string} [systemContext] Text prepended to the system prompt.
 * @property {string} [userContext] Text prepended to the user message.
 * @property {Object} [metadata] Free-form data, opaque to the kernel and driver, visible to providers in later layers.
 */

/**
 * Abstract base class for context providers (RAG, memory, retrieval, …).
 *
 * Subclasses MUST override {@link ContextProvider#name} (a non-empty
 * lower-kebab-case string used as the registry key) and
 * {@link ContextProvider#contribute}. Optionally override
 * {@link ContextProvider#dependsOn}, {@link ContextProvider#start}, and
 * {@link ContextProvider#stop}.
 *
 * Providers are registered as **singleton instances** (not classes), because
 * a provider typically owns a connection or cache. Plugins typically:
 *
 * ```js
 * class RagProvider extends ContextProvider {
 *   get name() { return 'rag' }
 *   async contribute() { return { systemContext: '...' } }
 * }
 * api.registerContextProvider(new RagProvider())
 * ```
 *
 * Plugin classes MUST extend this base. `api.registerContextProvider`
 * rejects instances that do not, so the kernel can rely on the base-class
 * invariants.
 *
 * @abstract
 */
export default class ContextProvider {
  /**
   * @throws {TypeError} If instantiated directly.
   */
  constructor() {
    if (new.target === ContextProvider) {
      throw new TypeError('ContextProvider is abstract and cannot be instantiated directly.')
    }
  }

  /**
   * Unique provider name, used as the registry key. Must be non-empty
   * lower-kebab-case (e.g. `rag`, `working-memory`, `code-graph`).
   * @abstract
   * @return {string}
   */
  get name() {
    throw new Error(`${this.constructor.name} must implement get name().`)
  }

  /**
   * Names of other context providers this one depends on. The kernel uses
   * this to compute dependency layers and ensure earlier layers' results are
   * visible in `ctx.contributions` when this provider's `contribute()` runs.
   * Default: no dependencies.
   * @return {string[]}
   */
  get dependsOn() {
    return []
  }

  /**
   * Produce a contribution for one turn. Return a {@link Contribution} object
   * to record this provider's output, or `undefined` to skip (no entry in
   * `message.context.entries`). Throwing causes the kernel to record an error
   * entry and emit `contextProviderError`; the turn continues.
   * @abstract
   * @param {ContextRequest} _ctx
   * @return {Contribution|void|Promise<Contribution|void>}
   */
  async contribute(_ctx) {
    throw new Error(`${this.constructor.name}.contribute() is not implemented.`)
  }
}
