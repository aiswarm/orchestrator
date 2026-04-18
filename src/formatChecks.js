/**
 * String-format check helpers.
 *
 * Plugin types, skill names, context-provider names, and other registry keys
 * have to satisfy specific string formats (lower-kebab-case for
 * user/web/npm-facing names; lower-snake-case for LLM tool-call names). This
 * module collects the patterns and assert helpers in one place. Future
 * string-format concerns (namespace parsing for `driver:tool` strings,
 * semver ranges, URL path segments, reverse-DNS plugin IDs) belong here too.
 *
 * Distinct from src/validators.js: that module validates plugin *objects*
 * (drivers, skills, context providers) and uses these helpers internally.
 *
 * Lives in its own module so the abstract base classes (agentDriver.js,
 * agentSkill.js) can use it without creating a cycle with src/validators.js,
 * which itself imports the base classes.
 *
 * See PLAN.md D13 and the header of src/validators.js for the rationale
 * behind the kebab/snake split.
 */

export const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9-]*$/
export const SNAKE_CASE_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * @param {string} value
 * @param {string} label Used in the error message (e.g. 'Driver type').
 * @throws {TypeError} If `value` is not a non-empty lower-kebab-case string.
 */
export function assertKebabCase(value, label) {
  if (typeof value !== 'string' || !value) {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
  if (!KEBAB_CASE_PATTERN.test(value)) {
    throw new TypeError(
      `${label} "${value}" must be lower-kebab-case (a-z, 0-9, -) and start with a letter.`
    )
  }
}

/**
 * @param {string} value
 * @param {string} label Used in the error message (e.g. 'Skill name').
 * @throws {TypeError} If `value` is not a non-empty lower-snake-case string.
 */
export function assertSnakeCase(value, label) {
  if (typeof value !== 'string' || !value) {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
  if (!SNAKE_CASE_PATTERN.test(value)) {
    throw new TypeError(
      `${label} "${value}" must be lower-snake-case (a-z, 0-9, _) and start with a letter. ` +
        'Skill names are sent verbatim to the LLM as tool function names.'
    )
  }
}
