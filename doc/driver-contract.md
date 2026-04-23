# `AgentDriver` contract

> Normative spec for the orchestrator ↔ driver boundary.
> Status: **draft for the multi-provider rewrite** (PLAN.md §4 D2/D6/D11/D12/D13).
> Audience: anyone writing an `@aiswarm/driver-*` package, and anyone changing the agent loop in the orchestrator core.
> Non-goal: implementation guidance. This document describes the _shape_ of the contract, not how a particular driver should call its provider's SDK.

This document supersedes the loose JSDoc currently scattered across `driver.openai.js` and `driver.generator.js`. Existing drivers will be migrated; new drivers are written against this spec from day one.

---

## 1. What a driver is

A driver is a plugin that turns one **incoming `Message` for one agent** into zero or more **outgoing `Message`s from that agent**, by talking to an LLM provider (or any other generative system).

A driver is **owned by exactly one agent instance** — the kernel constructs one driver per agent. Driver authors write a class that handles a single agent and don't need to manage multi-agent state; the kernel takes care of multiplicity. Driver state (provider thread IDs, prompt cache pointers, KV-cache hints, scratch context, streaming run state) lives on the instance and is naturally per-agent.

A driver MAY also publish **driver-scoped tools** (D11) — for example OpenAI's server-side `code_interpreter`, Anthropic's `web_search`, Gemini's image generation. These are exposed through the same skill registry as in-process skills and MCP tools, but the orchestrator only offers them to agents whose driver is this driver.

A driver MUST NOT:

- Touch `comms`, `groups`, or `history` directly. The kernel owns the social record (PLAN §3).
- Mutate other agents' state.
- Enrich its own context with RAG, memory, or workspace data — that is a `ContextProvider`'s job (D12). The driver receives an already-enriched payload and decides only how to fit it into its provider's context window.

---

## 2. Construction

```js
new Driver({ api, index, name, agentConfig, driverConfig })
```

| Arg            | Type           | Description                                                                                                              |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `api`          | `API`          | The orchestrator singleton. Drivers use `api.log`, `api.skills`, `api.comms`, `api.emit`, `api.on`. **Never `console`.** |
| `index`        | `AgentIndex`   | The agent index. Use to look up sibling agents when coordination is needed.                                              |
| `name`         | `string`       | The agent name this driver instance serves. Drivers SHOULD include this in every log line.                               |
| `agentConfig`  | `AgentConfig`  | The full per-agent config (`instructions`, `description`, `skills`, `groups`, `entrypoint`, `driver`).                   |
| `driverConfig` | `DriverConfig` | Convenience shortcut to `agentConfig.driver` — the provider-specific settings (model, mode, secrets refs). See §7.       |

Driver packages typically extend `DriverConfig` with their own provider-specific typedef and use it as `@param {MyDriverConfig} options.driverConfig`.

Constructor work SHOULD be cheap. Network calls and SDK auth should be lazy-initialized on the first `instruct()`. Drivers MUST treat `agentConfig` and `driverConfig` as input — do not write back into them.

---

## 3. Required surface

A driver is a **class**. The kernel registers the class once, then instantiates it once per agent that uses `driver.type === <this driver's type>`.

Every driver class MUST expose:

| Member              | Kind            | Purpose                                                                                                                         |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `static type`       | static field    | Short lower-kebab-case identifier used as the registry key and in agent config (e.g. `'anthropic'`, `'openai'`, `'generator'`). |
| `status`            | instance getter | One of `'created' \| 'idle' \| 'busy' \| 'paused' \| 'error'`. See §6.                                                          |
| `instruct(message)` | async fn        | Handle one inbound `Message`. See §5.                                                                                           |
| `pause()`           | fn              | Stop accepting new work. In-flight `instruct()` MAY complete; new calls SHOULD reject or no-op.                                 |
| `resume()`          | fn              | Reverse of `pause()`.                                                                                                           |

Optional but recommended:

| Member                    | Kind   | Purpose                                                                            |
| ------------------------- | ------ | ---------------------------------------------------------------------------------- |
| `capabilities`            | getter | See §8 (Q9).                                                                       |
| `nativeTools`             | getter | `string[]` of driver-scoped tool names this driver publishes. See §9 (D11, Q9).    |
| `registerSelfSkills(api)` | fn     | Hook called once after construction to register driver-scoped tools. See §9 (D11). |

### 3.1 Registration

A driver package registers its driver class during `initialize(api)`:

```js
// driver-anthropic/index.js
import AgentDriver from '@aiswarm/orchestrator/agentDriver.js'

class AnthropicDriver extends AgentDriver {
  static type = 'anthropic'
  // ...instruct(message), optional pause()/resume()
}

export function initialize(api) {
  api.registerAgentDriver(AnthropicDriver) // kernel reads AnthropicDriver.type
}
```

The single-argument form is the only supported form. The kernel reads `Class.type` to determine the registry key.

Driver classes MUST extend `AgentDriver`. The base class enforces the `static type` contract at construction time, provides a default `get type()`, and supplies no-op `pause()` / `resume()` so subclasses only override the hooks they care about. `api.registerAgentDriver` rejects classes that do not extend the base; the kernel relies on the base-class invariants.

### 3.2 Validation

The kernel validates driver classes at registration time via `assertValidDriver` in [src/validators.js](../src/validators.js). A malformed class fails fast with a `TypeError` naming the offending member, rather than crashing later when an agent first calls `instruct()`. The validator is the executable form of this contract — when this document and `assertValidDriver` disagree, the validator is authoritative.

Checks performed:

- `typeof Class === 'function'` (must be a class, not an instance or plain object).
- `Class.prototype instanceof AgentDriver` (must extend the base class).
- `Class.type` is a non-empty lower-kebab-case string matching `/^[a-z][a-z0-9-]*$/`.
- `Class.prototype.instruct` is overridden (not inherited from the abstract base).
- `Class.type` does not collide with an already-registered driver.

The `static type` shape is also enforced by the `AgentDriver` constructor at instantiation time, so a malformed subclass throws on its first `new` regardless of whether it ever reaches the registry. `pause` / `resume` are inherited as no-ops from the base and need not be overridden.

---

## 4. Lifecycle

```
construct → (idle ⇄ busy)* → pause? ⇄ resume?
```

1. **Construct.** Cheap. No network. Read config. Lazy-initialize provider sessions on first `instruct()`.
2. **Operating loop.** `comms` delivers `Message`s addressed to the agent; the kernel calls `instruct(message)` for each.
3. **`pause()` / `resume()`.** Cooperative throttle. Used by UI / config reloads.

The orchestrator does not currently provide a graceful-shutdown signal to drivers. Drivers that hold disposable provider resources (assistants, threads, sessions) must handle their own cleanup if they care — or rely on the provider's server-side TTLs.

The kernel guarantees `instruct()` is not called concurrently for the same driver instance. Drivers MAY assume serialized inbound calls per agent.

---

## 5. `instruct(message)` — the core call

```js
/**
 * @param {Message} message  Inbound message from comms (already enriched, see §10).
 * @returns {Promise<void | Message | string>}
 */
async instruct(message)
```

### 5.1 Inputs the driver has

The driver receives **one `Message`** and is expected to assemble whatever context it needs from these orchestrator-provided sources:

- `this.config` — agent-level driver config (model, mode, options).
- `api.skills.listForAgent(name)` — the resolved tool catalog for this agent. Includes in-process skills, configured MCP tools, and this driver's own self-skills (§9). The driver translates this list into the provider's tool-definition shape.
- `api.comms.history(name)` — the agent's message history. **The driver decides** whether to re-send full history, send a summary, rely on a server-side thread, or use prompt caching (D2). The orchestrator does not slice or summarize history for the driver.
- `message.context` — the merged contribution from `ContextProvider`s for _this_ turn. See §10.

### 5.2 Outputs the driver MAY return

| Return value         | Meaning                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| `undefined` / `void` | Driver handled the turn and emitted any messages itself via `api.comms.emit(...)`. |
| `string` (non-empty) | Convenience: kernel wraps it in a reply `Message` to `message.source` and emits.   |
| `Message` instance   | Kernel sets `status = processed` and emits as-is.                                  |

Empty / whitespace-only strings MUST NOT be wrapped. Returning `''` is equivalent to returning `undefined`.

A turn may produce **many** messages (streaming partials, tool-call traces, multimodal parts, intermediate "thinking" deltas). For multi-message turns, the driver SHOULD emit them itself via `api.comms.emit(...)` and return `undefined`. The single-string / single-Message return is a convenience for the trivial reply case.

### 5.3 Tool calls

Tool calls are part of the agent loop and are mediated through `api.skills`. When the provider asks for a tool:

1. Driver translates the provider's tool-call into `{ name, args }`.
2. Driver calls `api.skills.invoke({ agent: this.#name, name, args })` — this routes to the right producer (skill, MCP server, or **this driver's own self-skills**, §9).
3. Driver receives the tool result and feeds it back to the provider on the next turn.
4. Driver SHOULD emit a `Message` of type `Message.type.skill` for both the call and the result so UIs/transports/loggers can show tool use uniformly across providers (Q11).

Driver-scoped tools (§9) follow the same path — the difference is only that the "execution" is a passthrough flag to the provider, not a local function call.

### 5.4 Errors

`instruct()` SHOULD NOT throw. On provider failure the driver SHOULD:

1. Set `status = 'error'`.
2. Emit a reply `Message` describing the failure to `message.source` (so the user sees it in the UI).
3. Resolve the promise.

Throwing from `instruct()` is reserved for kernel-visible bugs (config invariant violated, programmer error). The kernel will log the throw and mark the agent errored.

---

## 6. `status`

```
'created'  initial, before first instruct()
'idle'     ready to accept work
'busy'     instruct() is in flight
'paused'   pause() was called
'error'    last instruct() failed; cleared on next successful turn
```

The kernel currently polls `driver.status` every 250 ms (`agent.js`) and emits `agentUpdated` on change. Drivers SHOULD instead **emit `agentUpdated` themselves** when `status` changes, by setting it through their host `Agent` (the kernel will switch to event-driven status in the same change that lands this contract). Until then, exposing `status` as a getter that returns the current value is sufficient.

---

## 7. `DriverConfig` shape

Per D4, two forms of agent driver config normalize to the same internal shape:

**Legacy:**

```js
{ driver: { type: 'anthropic', model: 'claude-sonnet-4-5', mode: 'messages' } }
```

**Short:**

```js
{
  model: 'anthropic/claude-sonnet-4-5'
}
```

After normalization the driver receives:

```js
{
  type: 'anthropic',                  // string, required, matches the registered driver name
  model: 'claude-sonnet-4-5',         // string, required, provider-specific
  mode: 'messages',                   // string, optional, driver-specific (e.g. 'responses' | 'realtime' | 'chat' for openai)
  options: { /* free-form */ }        // object, optional, provider-specific knobs
}
```

Env-var substitution (`${ANTHROPIC_API_KEY}`) is applied by the config parser before the driver sees the object (Q8).

A driver MUST validate its own config shape and fail fast in the constructor with a clear message naming the offending field.

---

## 8. `capabilities` (Q9)

Optional getter returning a flag bag. The orchestrator and UIs use it to enable / hide features. Missing fields default to `false`.

```js
get capabilities() {
  return {
    streaming: true,     // driver emits intermediate Messages during a turn
    tools: true,         // driver supports tool calls
    images: true,        // accepts image parts in input
    audio: false,        // accepts audio parts in input
    reasoning: true,     // surfaces 'reasoning' message parts
    cache: true,         // implements prompt caching internally (no orchestrator action needed)
    parallelTools: true  // can run multiple tool calls in one turn
  }
}
```

This is advisory. The kernel does not gate calls on capabilities — a driver that lacks `images` will reject an image-bearing message itself with a clear error.

---

## 9. Driver-scoped tools (D11)

A driver that publishes provider-native tools (OpenAI `code_interpreter`, Anthropic `web_search`, Gemini Google Search grounding, Bedrock Knowledge Bases, etc.) implements two extra hooks:

```js
get nativeTools() {
  return ['openai:web_search', 'openai:code_interpreter', 'openai:file_search']
}

registerSelfSkills(api) {
  api.registerAgentSkill(class extends api.skills.Skill {
    static name = 'openai:web_search'
    static description = 'OpenAI server-side web search.'
    static inputSchema = { /* JSON schema */ }
    static driverScope = 'openai'   // restricts to agents using driver type 'openai'
    async execute() {
      // Passthrough: the driver itself handles this in its provider call.
      // execute() is only invoked if the kernel routes through here for
      // a non-passthrough fallback (rare).
    }
  })
}
```

**Naming convention.** Driver-scoped tool names are namespaced with the driver's `type`: `openai:web_search`, `anthropic:web_search`, `gemini:image_generation`. Per D13, the user-facing reference in config is the full namespaced string — UIs may shorten it with a badge for display.

**Scoping.** When the orchestrator resolves an agent's tool list:

- If `tool.driverScope` is set and does not match the agent's `driver.type`, config validation **fails at load time** with a clear message (e.g. `"agent 'WriterBot' uses driver 'anthropic' but lists tool 'openai:web_search' which is openai-scoped"`).
- Drivers without a `nativeTools` getter behave identically to today.

**Execution.** The kernel routes a tool call by name through `api.skills.invoke(...)`. For driver-scoped tools, the producing driver's `instruct()` recognizes its own namespace prefix in a provider tool-call event and sets the appropriate provider passthrough flag instead of invoking `execute()` locally. Whether `execute()` is ever invoked is driver-specific (most providers run these tools entirely server-side).

---

## 10. Context enrichment (D12)

Before delivering a message to `instruct()`, the kernel runs registered `ContextProvider`s for the agent and attaches the merged result as `message.context`. The full provider-side spec (registration, dependency graph, execution model, error policy, cross-provider access) lives in [`context-provider-contract.md`](./context-provider-contract.md). What follows is only what a **driver** needs to know.

### 10.1 What the driver receives

```js
message.context = {
  entries: [
    {
      name: 'rag',
      systemContext: '<text>',         // optional
      userContext: '<text>',           // optional, prepended to the user message
      metadata: { /* free-form */ }    // optional, opaque to the driver
    },
    { name: 'memory', systemContext: '...', metadata: {...} }
    // ... more entries
  ]
}
```

- `entries` is **ordered**: topological order over provider `dependsOn` declarations, ties broken by the agent's `contexts: [...]` config-list order. The order is deterministic across runs given the same config and provider set.
- Each entry is contributed by exactly one provider, identified by `name`.
- `entries` is append-only by design — no provider can rewrite or remove another's contribution. The driver sees the complete record of what was contributed.
- `message.context` may be `undefined` (no providers configured for this agent) or `{ entries: [] }` (configured but produced nothing). Drivers MUST handle both.

### 10.2 What the driver does with it

The driver decides **how** to fit the contributions into the provider's context window. The `name` field lets a driver apply per-source rendering when it cares to:

- **Default behavior.** Concatenate `entries[*].systemContext` in order and prepend the result to the agent's base system prompt; concatenate `entries[*].userContext` in order and prepend the result to the outbound user message. Context frames the agent's primary content in both slots.
- **Provider-aware optimization.** A driver MAY treat specific entry names specially — e.g. the Anthropic driver puts the long `rag` entry in the _cached_ portion of `system` while keeping the small `memory` entry uncached. The driver knows nothing about what `rag` _means_ — it only knows its provider's caching shape.
- **Multimodal entries.** When `userContext` is present, the driver prepends it to the outbound user message as text. (Message content is currently string-only; if a future Message shape carries multi-part content, drivers and the Contribution typedef should grow together.)
- **Unknown names are not special.** A driver MUST NOT skip an entry just because it doesn't recognize the name. Unknown names get the default treatment.

`metadata` is opaque to the driver and exists for provider↔provider communication (e.g. RAG records its source paths so memory can dedupe). Drivers SHOULD pass it through to UI/transport observers via the events in §11 but MUST NOT make routing decisions based on it.

### 10.3 Lifecycle hooks the driver may observe

- `contextReady` — emitted by the kernel after providers run, before `instruct()`. Drivers normally don't subscribe; UIs and loggers do.
- `agentTurnCompleted` — emitted by the kernel after `instruct()` resolves, with `{ agent, finalMessage, contextMetadata }`. Memory / episodic providers subscribe here to record outcomes; drivers don't need to.

### 10.4 Backward compatibility

A driver that does not understand `message.context` at all MUST ignore it gracefully — context is additive, never required for correctness. Existing drivers continue to work unchanged until they opt in.

---

## 11. Events the driver interacts with

Emitted by the kernel; drivers MAY subscribe:

- `contextRequested` — handled by context providers, not drivers. See [`context-provider-contract.md`](./context-provider-contract.md).
- `contextReady` — read-only observation hook fired after all providers have run. See §10.3.
- `agentTurnCompleted` — fired by the kernel after `instruct()` resolves.

Emitted by the driver:

- `api.comms.emit(message)` for each user-visible message produced (reply, tool-call trace, tool-result trace, partial stream chunk).
- `agentUpdated` (via the host Agent) on `status` change.
- Optional driver-specific events under a namespaced name (`openai:rateLimitHit`, etc.) for observability. Plugins may listen.

Drivers MUST NOT invent events on the kernel namespace — only namespaced events. If something feels like it should be a kernel event, raise it as a contract change.

---

## 12. Multimodal / message parts (Q5)

The full `Message.parts[]` shape is being designed in parallel (PLAN Q5). Until it lands, drivers operate on `message.content` (string) as today. When the parts shape is finalized, this section will list the canonical part types (`text | tool_call | tool_result | image | audio | reasoning | resource_ref`) and the driver's responsibility to map them to/from provider-native shapes.

A driver MAY ship part-aware support ahead of the kernel by reading `message.parts` if present and falling back to `message.content` otherwise.

---

## 13. Portability (D9)

Drivers SHOULD avoid Node-only imports where feasible. Most drivers are HTTPS clients to a remote provider and naturally portable. Drivers that are inherently Node-bound (a future `driver-ollama` talking to a local daemon, a stdio MCP-backed driver) MUST document the constraint at the top of their README:

> Runs in: Node only — requires `child_process` to spawn `ollama serve`.

No runtime check is required. The bundler / runtime will fail loudly if a Node-only import is used in a browser, and `package.json#engines` covers the install-time signal.

---

## 14. Reference implementations

| Driver                                 | Status                   | Use as reference for                                           |
| -------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| `orchestrator/src/driver.generator.js` | reference / test double  | Minimal shape, no provider, deterministic.                     |
| `driver-anthropic`                     | planned (D6 #1)          | Stateless `instruct()`, prompt caching, tool calls.            |
| `driver-openai`                        | migration target (D6 #2) | `mode: 'responses' \| 'realtime' \| 'chat'`, self-skills (§9). |
| `driver-gemini`                        | planned (D6 #3)          | Multimodal parts, native code execution.                       |
| `driver-aws-bedrock`                   | archive (D8)             | —                                                              |

---

## 15. Out of scope for this contract

- The MCP client surface (lives in `@aiswarm/mcp-client` per D7; drivers consume MCP tools through `api.skills` like any other tool).
- The `ContextProvider` interface — see [`context-provider-contract.md`](./context-provider-contract.md).
- The transport / API adapter interface (`api-graphql` and friends).
- Skill parameter doc unification (Q4 — pending separate decision).

---

## 16. Change discipline

This document is normative. Changes that affect existing drivers go through PLAN.md §10 (decision log) first. Editorial fixes (typos, clarifications that do not change behavior) can land directly. When a contract change is made, every driver in the table at §14 is updated in the same release wave.
