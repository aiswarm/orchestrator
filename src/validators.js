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

import AgentDriver from '../agentDriver.js'
import AgentSkill from '../agentSkill.js'
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
 * Context providers do not yet have a base class, so this remains a structural check.
 * @param {*} provider The instance passed to api.registerContextProvider.
 * @param {string[]} [existingNames] Already-registered provider names, for collision detection.
 * @throws {TypeError} If the provider is missing the required shape.
 * @throws {Error} If the name collides with an already-registered provider.
 */
export function assertValidContextProvider(provider, existingNames = []) {
  if (provider == null || typeof provider !== 'object') {
    throw new TypeError(
      'registerContextProvider expects a provider instance, got ' +
        (provider === null ? 'null' : typeof provider) +
        '.'
    )
  }
  if (typeof provider.name !== 'string' || !provider.name) {
    throw new TypeError(
      'Context provider is missing required "name" property. See doc/context-provider-contract.md §2.'
    )
  }
  assertKebabCase(provider.name, `Context provider name`)
  if (provider.dependsOn != null && !Array.isArray(provider.dependsOn)) {
    throw new TypeError(
      `Context provider "${provider.name}" has invalid "dependsOn": expected string[], got ${typeof provider.dependsOn}.`
    )
  }
  if (Array.isArray(provider.dependsOn)) {
    for (const dep of provider.dependsOn) {
      if (typeof dep !== 'string' || !dep) {
        throw new TypeError(
          `Context provider "${provider.name}" has invalid entry in "dependsOn": expected non-empty string, got ${typeof dep}.`
        )
      }
    }
  }
  if (typeof provider.contribute !== 'function') {
    throw new TypeError(
      `Context provider "${provider.name}" is missing required "contribute" method. See doc/context-provider-contract.md §4.`
    )
  }
  if (existingNames.includes(provider.name)) {
    throw new Error(
      `Context provider name "${provider.name}" is already registered. ` +
        'Two plugins tried to register the same context provider name.'
    )
  }
}
