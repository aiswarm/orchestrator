# `ContextProvider` contract

> Normative spec for the orchestrator ↔ context-provider boundary.
> Status: **draft for the multi-provider rewrite** (PLAN.md §4 D12, D13).
> Audience: anyone writing an `@aiswarm/context-*` plugin (RAG, memory, episodic, summarizer, workspace scanner, etc.) and anyone changing the agent loop in the orchestrator core.
> Companion to [`driver-contract.md`](./driver-contract.md). Section 10 of that document is the driver-side view of the same flow.

This document is the authoritative spec for D12. It defines:

1. How a context provider registers itself with the kernel.
2. How providers declare ordering dependencies on each other.
3. What each provider receives at turn time and what it may contribute.
4. How providers that depend on each other share data and call into each other.
5. Error policy and lifecycle hooks.

---

## 1. What a context provider is

A context provider is a plugin that **enriches what an LLM sees on a turn**, independently of which LLM is running. RAG, long-term memory, episodic recall, rolling summarization, workspace-file retrieval, knowledge-graph lookups — all are context providers. They run in the agent loop _between_ "message arrives at agent" and "driver builds the provider context window."

A provider produces a **`Contribution`** for one turn: an optional system-text addition, optional message parts (multimodal additions), and an optional opaque metadata bag for other providers to consume.

A context provider is **driver-agnostic.** It does not know whether the agent is on Anthropic, OpenAI, Gemini, or a local model. The driver decides how to fit contributions into its provider's context window (driver-contract §10).

A context provider is a **singleton.** Unlike drivers (which the kernel instantiates once per agent), a context provider is constructed once during plugin init and serves every agent that opted into it. This is intentional: providers typically own expensive shared resources — a database connection pool, an embedding model loaded into memory, an LRU retrieval cache, a workspace file-tree index, an HTTP keep-alive session. Per-agent state, when a provider needs it, is keyed internally by `agent.name`. The agent identity is delivered on every `contribute()` call (§4.2).

A context provider MAY also expose **public methods** for other plugins to call imperatively (e.g. a RAG plugin exposes `query()` and `embed()` so a memory plugin can use them). This is just JS — whatever methods the provider object has are part of its public contract.

---

## 2. Registration

A plugin registers a context provider during its `initialize(api)` call:

```js
// rag plugin's index.js
import ContextProvider from '@aiswarm/orchestrator/contextProvider.js'

class RagProvider extends ContextProvider {
  get name() {
    return 'rag'
  }
  async contribute() {
    return { systemContext: '…' }
  }
}

export function initialize(api, config) {
  api.registerContextProvider(new RagProvider(api, config))
}
```

The signature is:

```js
api.registerContextProvider(providerInstance)
```

Provider classes MUST extend the abstract `ContextProvider` base class; the kernel rejects instances that do not. The base class is the single source of truth for the contract — see [contextProvider.js](../src/contextProvider.js).

The kernel reads the registry key from `provider.name` (an instance getter the subclass overrides). This matches the existing `api.registerAgentSkill(SkillClass)` pattern, where the kernel reads `instance.name` rather than taking a separate name argument. The `api.registerAgentDriver(DriverClass)` call uses `DriverClass.type` (static, since drivers are registered as classes). All three plugin-type registrations follow the same one-source-of-truth principle.

Name collisions are a load-time error.

After registration, the provider is retrievable by any other plugin via:

```js
api.contextProviders.get('rag') // returns the same providerObject
api.contextProviders.list() // returns array of { name, dependsOn }
```

The kernel-facing members on a `ContextProvider` subclass:

| Member                       | Required? | Type             | Purpose                                                                                                                                      |
| ---------------------------- | --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `get name()`                 | required  | `string`         | Lower-kebab-case identifier (per D13). Used as the registry key, in agent config, in logs, in contributions, and in dependency declarations. |
| `get dependsOn()`            | optional  | `string[]`       | Names of providers that must run before this one. Base class default: `[]`.                                                                  |
| `contribute(contextRequest)` | required  | `async function` | Called by the kernel once per turn. See §4.                                                                                                  |

Anything else on the subclass is the plugin's public API for other plugins to call (see §6). Going from a contribution back to its provider instance is `api.contextProviders.get(name)`; going from a provider instance to its name is `provider.name`.

### 2.1 Validation

The kernel validates context providers at registration time via `assertValidContextProvider` in [src/validators.js](../src/validators.js). A malformed provider fails fast with a `TypeError` naming the offending member, rather than crashing later when an agent first triggers the context-enrichment pipeline. The validator is the executable form of this contract — when this document and `assertValidContextProvider` disagree, the validator is authoritative.

Checks performed:

- `provider instanceof ContextProvider` (subclass requirement).
- `provider.name` is a non-empty string matching `/^[a-z][a-z0-9-]*$/` (the abstract getter throws if not overridden).
- `provider.dependsOn` is an array of non-empty strings (base default `[]` satisfies this).
- `provider.contribute` overrides the abstract base method.
- `provider.name` does not collide with an already-registered context provider.

Cycle detection on `dependsOn` is performed when the kernel computes the topological execution order (not at registration time, since later registrations may complete a cycle).

---

## 3. Configuration — opting an agent in

Context providers are inert until an agent's config opts in by name (D12, D13):

```js
{
  agents: {
    Researcher: {
      driver: { type: 'anthropic', model: 'claude-sonnet-4-5' },
      contexts: ['rag', 'memory'],
      // ...
    },
    QuickReplyBot: {
      driver: { type: 'openai', model: 'gpt-5-mini' }
      // no context: enrichment is skipped entirely for this agent
    }
  }
}
```

Config-resolution rules:

- An agent with **no `context`** key gets no enrichment. `message.context` is `undefined` for its turns.
- Names listed in `context` that are not registered are a **load-time error** with a clear message ("agent 'Researcher' lists context provider 'memory' but no such provider is registered — did you install `@aiswarm/context-memory`?"). Optional dependencies belong in code (`api.contextProviders.get('rag')?.…`), not in config typos.
- Order in `contexts: [...]` is a **tiebreaker** for the dependency graph (§4.3), not the primary execution order.
- A `global.context` and `group.context` may be added later as a convenience for fleet-wide defaults; for v1, configure per agent.

---

## 4. Execution model

### 4.1 The per-turn flow

```
message arrives on comms for agent A
  ↓
kernel resolves A's contexts: [...] list to a set of providers
  ↓
kernel computes dependency layers (topological sort)
  ↓
for each layer L:
  parallel: await all providers in L (each returns a Contribution or undefined)
  ↓
kernel assembles message.context = { entries: [...] in deterministic order }
  ↓
kernel emits 'contextReady' { agent, message }
  ↓
driver.instruct(message)
  ↓
kernel emits 'agentTurnCompleted' { agent, finalMessage, contextMetadata }
```

### 4.2 The `contextRequest` payload

Each provider's `contribute(ctx)` receives:

```js
{
  ;(agent, // the Agent instance
    incomingMessage, // the Message about to be delivered to the driver
    contributions) // Map<string, Contribution> — what providers in earlier layers contributed
}
```

The handler returns a `Contribution` object (recorded as this provider's entry) or `undefined` (no entry).

```

Contract notes:

- `contributions` is **read-only** to the handler. It contains entries from all providers in _strictly earlier_ layers — never from peers in the same layer (which are running in parallel and may not have finished). This is what makes parallel-within-layer safe.
- `contributions` is keyed by provider **name** (string). Going from a contribution back to its provider object is `api.contextProviders.get(name)`; going from a provider object to its name is `provider.name`.
- Returning a `Contribution` object records this provider's entry. Returning `undefined` (or nothing) means "no contribution this turn" — the provider is omitted from `entries`.
- The kernel light-validates the result: it must be a plain object, and the known keys (`systemContext: string`, `userContext: array`, `metadata: plain object`) must have the right type. Unknown keys pass through unchanged. Any contract violation is treated as if `contribute()` had thrown — see §5.
- A provider that throws from `contribute()` is handled per §5.

### 4.3 Dependency graph and ordering

For one turn:

1. Filter the registered provider set to those listed in the agent's `context`.
2. Build a directed graph: edge `A → B` if `B.dependsOn` includes `A` _and_ `A` is in the agent's `context` list. (Deps to providers not in the agent's context are silently dropped — see §4.4.)
3. Detect cycles → load-time error with the cycle named.
4. Compute topological layers. Layer 0 = nodes with no in-edges to others in the set; layer N+1 = nodes whose deps are all satisfied by layers 0..N.
5. Within a layer, execution order is undefined and parallel.
6. Across layers, execution is sequential — layer N+1 starts only after every provider in layer N has resolved (or failed per §5).
7. **Deterministic `entries` order**: providers are sorted by (layer asc, index in agent's `contexts: [...]` asc). This makes the prompt the LLM sees stable across runs.

Worked example from PLAN's multi-layer memory case:

```

Registered providers: rag (deps=[]), memory (deps=['rag']), workspace (deps=[])
Agent config: contexts: ['rag', 'memory', 'workspace']

Graph:
rag → memory
workspace (independent)

Layers:
L0: rag, workspace (parallel)
L1: memory (after L0 finishes)

Execution:
t=0 ms rag.contribute() and workspace.contribute() start in parallel
t=120 ms workspace finishes (cheap fs scan)
t=400 ms rag finishes (vector query + rerank)
t=400 ms memory.contribute() starts; sees contributions Map with 'rag' and 'workspace'
t=520 ms memory finishes
→ message.context.entries = [rag, workspace, memory] (L0 in config order, then L1)

````

### 4.4 Optional vs hard dependencies

`dependsOn` is **advisory ordering**. It expresses "if this other provider is going to run, run it first." It does NOT mean "this other provider must exist."

- If a dependency is not registered at all, the kernel logs `info` ("provider 'memory' depends on 'rag' which is not registered — running without it") and runs the dependent provider anyway. The dependent provider sees no entry for the missing dep in `contributions` and decides what to do (often: gracefully degrade).
- If a dependency is registered but the _agent_ didn't opt into it (not in the agent's `contexts: [...]`), same behavior — no edge is drawn for that turn, the dependent runs without seeing it.
- Hard dependencies belong in `package.json#peerDependencies`. npm warns the user at install time that `@aiswarm/context-memory` requires `@aiswarm/context-rag`. The kernel does not duplicate this signal.

```js
// memory plugin's package.json
{
  "peerDependencies": {
    "@aiswarm/context-rag": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "@aiswarm/context-rag": { "optional": true }
  }
}
````

---

## 5. Error policy

A provider's `contribute()` MAY throw. The kernel handles it as follows:

1. Catch the throw.
2. Emit `contextProviderError` with `{ agent, providerName, error }` for observability.
3. Mark the provider's slot in `contributions` as `{ error: true, message: error.message }` (visible to dependents in later layers if they want to react).
4. **Continue the turn.** The agent's reply is more valuable than a perfect context. The driver receives `message.context` with the failed provider's entry omitted from `entries`.

Rationale: a flaky vector store or down RAG service should degrade gracefully, not block every reply. Providers that consider their absence catastrophic (e.g. a security-policy filter) should instead express that by listening to `contextProviderError` and themselves emitting a refusal `Message`, or by failing closed inside the _driver_ (out of scope here).

A dependent in a later layer that sees an error in an upstream contribution can decide:

- proceed without it (`contributions.get('rag')?.error ? fallback() : useRag(...)`)
- propagate by also throwing
- emit a warning into its own contribution

The kernel does not enforce any of these.

---

## 6. Calling other providers imperatively

A provider that has been listed as a dependency MAY simply read another's contribution from the `contributions` Map. But sometimes that isn't enough — a memory provider might want to call `rag.query(refinedQuery, { exclude: alreadyFetched })` rather than just consume what rag chose to contribute.

The pattern is: **the registry is the handle.**

```js
// memory plugin
async contribute({ incomingMessage, contributions }) {
  const rag = api.contextProviders.get('rag')
  const ragSources = contributions.get('rag')?.metadata?.sources ?? []

  // ask RAG for more, knowing what it already found
  const extra = rag
    ? await rag.query(refineQuery(incomingMessage), { exclude: ragSources })
    : []

  const episodic = await this.#recall(incomingMessage)
  return {
    systemContext: render(episodic, extra),
    metadata: { sources: extra.map(e => e.path), episodicHits: episodic.length }
  }
}
```

Rules:

- The methods exposed on a provider object are its **public API.** Document them in the plugin's README.
- Cross-provider calls happen during `contribute()` of the dependent, after the kernel has guaranteed the dep finished (because of the `dependsOn` declaration).
- Calling a provider that the agent didn't opt into is allowed (you have the registry handle, not a per-agent permission), but you bypass user intent — providers SHOULD prefer reading `contributions` first and fall back to imperative calls only when necessary.

---

## 7. The `Contribution` shape

```js
{
  systemContext?: string,                 // text the driver prepends to the system prompt
  userContext?: string,                   // text the driver prepends to the user message
  metadata?: object                       // free-form, opaque to the kernel and driver, visible to other providers
}
```

Conventions for `metadata`:

- Use stable, namespaced-ish keys when other providers are likely to care: `{ sources: ['/repo/auth.ts'], hitCount: 5 }`. Documented in README.
- The kernel and drivers do not interpret metadata. Only other providers and observability listeners do.
- Avoid putting huge blobs in metadata; if a provider wants to share something large with downstreams, share _via the imperative call path_ (§6), not via metadata cloning.

---

## 8. Lifecycle and concurrency

- A provider that needs async warmup (open a DB connection, hydrate a cache) SHOULD perform it in its plugin's `initialize(api)` before calling `api.registerContextProvider(...)`. The plugin loader awaits each `initialize()`, so registration happens only after the provider is ready.
- `contribute()` for a single agent is serialized — the kernel does not call it twice concurrently for the same agent. Across agents it MAY be called concurrently; provider implementations must be re-entrant or use their own locking.
- Provider state that is per-agent SHOULD be keyed by `agent.name` inside the provider, since the same provider instance serves all agents that opted into it.

---

## 9. Portability (D9)

Context providers, like drivers, SHOULD avoid Node-only imports where feasible. A `context-vector` provider talking to pgvector over HTTPS is portable; a `context-workspace` provider walking the local filesystem is Node-only and must say so in its README:

> Runs in: Node only — scans the local filesystem.

No runtime check is required.

---

## 9.1 Built-in providers

The orchestrator ships one provider out of the box, registered the same way as the built-in `generator` driver and the core skills (see [src/index.js](../src/index.js)):

- **`static`** — injects a single, globally-configured contribution into every agent that opts in. Configured under the global `contexts.static` section using the {@link Contribution} field names directly (`systemContext`, `userContext`, `metadata`); agents only carry the opt-in name in their `contexts` array:

  ```js
  contexts: {
    static: {
      systemContext: 'You are part of an autonomous agent swarm.',
      userContext: 'Mission: refactor auth.',
      metadata: { tag: 'mission-control' }
    }
  }

  // Per agent (just the opt-in):
  agents: {
    Researcher: { contexts: ['static'] }
  }
  ```

  All three fields are optional; configure any subset. Validation runs once at provider-construction time (config snapshots, no runtime observation — same pattern as built-in skills/drivers). When the configured contribution is empty, the provider returns `undefined` and no entry is recorded.

  When `text` is missing or empty the provider returns no contribution, so the entry simply doesn't appear in `message.context.entries`. More sophisticated providers (RAG, memory, workspace) are shipped as separate plugins.

### Per-provider config

Provider options live in the global config under `contexts.{providerName}`, mirroring how `skills.{name}` and `drivers.{type}` work. The provider is constructed with `{api}` and reads its own slice from `api.config.contexts[providerName]`. The agent's `AgentConfig` only carries the opt-in list (`contexts: [...]`), never per-provider options — this keeps the agent shape agnostic of which providers are installed.

If a provider needs _per-agent_ variation (e.g. different text for two agents), users should register two named providers (e.g. `static-researcher`, `static-coder`) rather than push provider data into `AgentConfig`.

---

## 10. Reference layout for a context-provider package

```
@aiswarm/context-rag/
├── package.json          // keywords: ['@aiswarm:plugin'], peerDependencies for hard deps
├── README.md             // documents config shape, public methods, env requirements, runtime constraints
├── index.js              // export function initialize(api, config) { api.registerContextProvider(new RagProvider(api, config)) }
└── src/
    └── rag-provider.js   // class RagProvider { name = 'rag'; dependsOn = []; async contribute(ctx) {...}; async query(text, opts) {...} }
```

A bare-minimum provider for testing is just an object literal:

```js
// in any plugin's initialize()
api.registerContextProvider({
  name: 'echo',
  dependsOn: [],
  async contribute({ incomingMessage }) {
    return { systemContext: `(echo: last user message was "${incomingMessage.content}")` }
  }
})
```

---

## 11. Open items deferred from D12

- **`global.context` / `group.context` config inheritance.** Not in v1; revisit when the first three concrete providers exist and we see config repetition pain.
- **A `contextRequested` event in addition to the registered-provider mechanism.** Considered and rejected — event-bus broadcast can't express ordering or read-after-write between handlers. Providers are registered, not subscribed.
- **Skill-callable form** (`searchMemory(query)` as both an auto-injecting context provider AND an agent-callable skill). Allowed today: the same plugin can call `api.registerContextProvider(...)` and `api.registerAgentSkill(...)` from its `initialize`. No new mechanism needed.

---

## 12. Change discipline

This document is normative. Breaking changes to the registration shape or `contextRequest` payload go through PLAN.md §10 first. Editorial fixes land directly. When the contract changes, every provider package in the ecosystem at the time of the change is updated in the same release wave.
