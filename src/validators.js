/**
 * Runtime validators for plugin registrations.
 *
 * These run at registration time (driver / skill / context-provider) so that
 * malformed plugins fail fast at load time with a useful error message,
 * instead of crashing mid-run with a misleading "not found".
 *
 * The validators are the executable form of the contract documented in
 * doc/driver-contract.md and doc/context-provider-contract.md. When the docs
 * and the validators disagree, the validators are authoritative.
 *
 * Drivers and skills MUST extend their respective base class. Duck-typed
 * implementations are no longer accepted: the base class constructors enforce
 * shape contracts (e.g. `static type` validation on AgentDriver) that the
 * kernel relies on.
 *
 * Naming conventions enforced here follow the surface where each name lives:
 *   - Plugin-type names (driver `static type`, context-provider `name`) are
 *     **lower-kebab-case** because they appear in user config, npm package
 *     names, URLs, log prefixes, and the D11 namespacing prefix
 *     (`openai:web_search`). See PLAN.md D13.
 *   - Skill names are **lower-snake-case** because they are sent verbatim to
 *     the LLM as tool function names, where snake_case is the established
 *     convention across every major LLM SDK.
 * Allowing both would create collision ambiguity (`my-driver` vs `my_driver`),
 * so each surface picks one and sticks with it.
 */

import AgentDriver from './agentDriver.js'
import AgentSkill from './agentSkill.js'
import ContextProvider from './contextProvider.js'
import { assertKebabCase, assertSnakeCase } from './formatChecks.js'

/**
 * @param {*} value
 * @param {string} registerCall Name of the registration entry point, used in the error message.
 * @throws {TypeError} If `value` is not a class (function).
 */
function assertConstructible(value, registerCall) {
  if (typeof value !== 'function') {
    throw new TypeError(
      `${registerCall} expects a class, got ${value === null ? 'null' : typeof value}.`
    )
  }
}

/**
 * Assert that `Class` is a valid AgentDriver class per the driver contract.
 * Requires `Class` to extend {@link AgentDriver} — the base class constructor enforces
 * the `static type` shape contract, so this validator only checks what the base class
 * cannot enforce on its own (subclass overrode `instruct`, no type collision).
 * @param {*} Class The value passed to api.registerAgentDriver.
 * @param {string[]} [existingTypes] Already-registered driver types, for collision detection.
 * @throws {TypeError} If the class is not a subclass of AgentDriver, or did not override `instruct`.
 * @throws {Error} If the type collides with an already-registered driver.
 */
export function assertValidDriver(Class, existingTypes = []) {
  assertConstructible(Class, 'registerAgentDriver')
  const className = Class.name || '<anonymous>'
  if (Class === AgentDriver || !(Class.prototype instanceof AgentDriver)) {
    throw new TypeError(
      `Driver ${className} must extend AgentDriver. ` +
        'Add `extends AgentDriver` to the class declaration and call `super()` from the constructor.'
    )
  }
  /*
   * The AgentDriver constructor validates `static type` shape on instantiation; mirror it here
   * so registration fails fast without needing to construct the driver.
   */
  assertKebabCase(Class.type, `Driver ${className} static type`)
  if (Class.prototype.instruct === AgentDriver.prototype.instruct) {
    throw new TypeError(
      `Driver ${className} (type "${Class.type}") must override the abstract "instruct" method. ` +
        'See doc/driver-contract.md §3.'
    )
  }
  if (existingTypes.includes(Class.type)) {
    throw new Error(
      `Driver type "${Class.type}" is already registered. ` +
        'Two plugins tried to register the same driver type.'
    )
  }
}

/**
 * Assert that `instance` is a valid AgentSkill instance per the skill contract.
 * Called after the kernel has constructed the skill via `new SkillClass({api})`.
 * Requires the instance to be `instanceof AgentSkill`.
 * @param {*} instance The constructed skill.
 * @param {string} className The skill class name, for error messages.
 * @param {string[]} [existingNames] Already-registered skill names, for collision detection.
 * @throws {TypeError} If the instance does not extend AgentSkill or has invalid name/description/execute.
 * @throws {Error} If the name collides with an already-registered skill.
 */
export function assertValidSkill(instance, className, existingNames = []) {
  if (!(instance instanceof AgentSkill)) {
    throw new TypeError(
      `Skill ${className} must extend AgentSkill. ` +
        'Add `extends AgentSkill` to the class declaration and call `super()` from the constructor.'
    )
  }
  if (typeof instance.name !== 'string' || !instance.name) {
    throw new TypeError(`Skill ${className} must override get name() to return a non-empty string.`)
  }
  assertSnakeCase(instance.name, `Skill ${className} name`)
  if (typeof instance.description !== 'string' || !instance.description) {
    throw new TypeError(
      `Skill ${instance.name} (${className}) must override get description() to return a non-empty string.`
    )
  }
  if (instance.execute === AgentSkill.prototype.execute) {
    throw new TypeError(
      `Skill ${instance.name} (${className}) must override the abstract "execute" method.`
    )
  }
  if (existingNames.includes(instance.name)) {
    throw new Error(
      `Skill name "${instance.name}" is already registered. ` +
        'Two plugins tried to register the same skill name.'
    )
  }
}

/**
 * Pre-construction check used by {@link Skills#add} so a malformed skill class
 * fails before its (potentially side-effectful) constructor runs.
 * @param {*} Class The value passed to api.registerAgentSkill.
 * @throws {TypeError} If the class does not extend AgentSkill.
 */
export function assertValidSkillClass(Class) {
  assertConstructible(Class, 'registerAgentSkill')
  if (Class === AgentSkill || !(Class.prototype instanceof AgentSkill)) {
    const className = Class.name || '<anonymous>'
    throw new TypeError(
      `Skill ${className} must extend AgentSkill. ` +
        'Add `extends AgentSkill` to the class declaration and call `super()` from the constructor.'
    )
  }
}

/**
 * Assert that `provider` is a valid context provider per the context-provider contract.
 * Requires the instance to extend {@link ContextProvider}.
 * @param {*} provider The instance passed to api.registerContextProvider.
 * @param {string[]} [existingNames] Already-registered provider names, for collision detection.
 * @throws {TypeError} If the provider does not extend ContextProvider or has invalid shape.
 * @throws {Error} If the name collides with an already-registered provider.
 */
export function assertValidContextProvider(provider, existingNames = []) {
  if (!(provider instanceof ContextProvider)) {
    throw new TypeError(
      'registerContextProvider expects an instance of ContextProvider. ' +
        'Add `extends ContextProvider` to the class declaration and call `super()` from the constructor.'
    )
  }
  if (typeof provider.name !== 'string' || !provider.name) {
    throw new TypeError(
      `Context provider ${provider.constructor.name} must override get name() to return a non-empty string. ` +
        'See doc/context-provider-contract.md §2.'
    )
  }
  assertKebabCase(provider.name, `Context provider name`)
  if (!Array.isArray(provider.dependsOn)) {
    throw new TypeError(
      `Context provider "${provider.name}" has invalid "dependsOn": expected string[], got ${typeof provider.dependsOn}.`
    )
  }
  for (const dep of provider.dependsOn) {
    if (typeof dep !== 'string' || !dep) {
      throw new TypeError(
        `Context provider "${provider.name}" has invalid entry in "dependsOn": expected non-empty string, got ${typeof dep}.`
      )
    }
  }
  if (provider.contribute === ContextProvider.prototype.contribute) {
    throw new TypeError(
      `Context provider "${provider.name}" must override the abstract "contribute" method. ` +
        'See doc/context-provider-contract.md §4.'
    )
  }
  if (existingNames.includes(provider.name)) {
    throw new Error(
      `Context provider name "${provider.name}" is already registered. ` +
        'Two plugins tried to register the same context provider name.'
    )
  }
}

/**
 * Validate the value returned from `provider.contribute()` for one turn.
 * Runs in the per-turn hot path, so this is intentionally cheap.
 *
 * @param {string} providerName Used in error messages.
 * @param {*} contribution Whatever `contribute()` returned (non-null).
 * @throws {TypeError} If `contribution` violates the Contribution contract.
 */
export function assertValidContribution(providerName, contribution) {
  if (typeof contribution !== 'object' || Array.isArray(contribution)) {
    throw new TypeError(
      `Context provider "${providerName}" returned ${Array.isArray(contribution) ? 'an array' : typeof contribution} from contribute(); expected a Contribution object.`
    )
  }
  if ('systemContext' in contribution && typeof contribution.systemContext !== 'string') {
    throw new TypeError(
      `Context provider "${providerName}" returned invalid "systemContext": expected string, got ${typeof contribution.systemContext}.`
    )
  }
  if ('userContext' in contribution && typeof contribution.userContext !== 'string') {
    throw new TypeError(
      `Context provider "${providerName}" returned invalid "userContext": expected string, got ${typeof contribution.userContext}.`
    )
  }
  if (
    'metadata' in contribution &&
    (contribution.metadata === null ||
      typeof contribution.metadata !== 'object' ||
      Array.isArray(contribution.metadata))
  ) {
    throw new TypeError(
      `Context provider "${providerName}" returned invalid "metadata": expected plain object, got ${Array.isArray(contribution.metadata) ? 'array' : typeof contribution.metadata}.`
    )
  }
}
