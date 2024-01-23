/**
 * Reads the configuration from the file system.
 * @description This module reads the configuration from the file system based on a given path. Depending on whether the
 * path is a file or directory, the configuration is parsed and processed here into a single combined json object.
 * Directories will be parsed recursively to build the configuration object, using directory and file names as keys.
 *
 * You can look at the test cases to see examples of configuration files and how they are parsed.
 */

/**
 * @typedef {Class} Config
 * @description This is main structure of the configuration object. It includes many sub-objects that are used to
 * configure the system.
 * @property {Object} global The global configuration object. Settings here will be applied to map settings of their respective groups.
 * @property {AgentConfig} global.agents The global agent configuration object. Settings here will be applied to map agents.
 * @property {DriverConfig} drivers The driver configuration object. Keys are driver types, values are driver configuration objects.
 * @property {Object.<string, string[]>} groups Groups of agents, keys are group names, values are lists of agent names or types.
 * @property {Object.<string, AgentConfig>} agents Agents to add on startup, keys are agent names, values are agent configuration objects.
 */

/**
 * @typedef {Class} Config
 * @description This is main structure of the configuration object. It includes many sub-objects that are used to
 * configure the system.
 * @property {Object} global The global configuration object. Settings here will be applied to map settings of their respective groups.
 * @property {AgentConfig} global.agents The global agent configuration object. Settings here will be applied to map agents.
 * @property {DriverConfig} drivers The driver configuration object. Keys are driver types, values are driver configuration objects.
 * @property {Object.<string, string[]>} groups Groups of agents, keys are group names, values are lists of agent names or types.
 * @property {Object.<string, AgentConfig>} agents Agents to add on startup, keys are agent names, values are agent configuration objects.
 */
import fs from 'fs'
import path from 'path'
import log from 'loglevel'

import defaultConfig from './config.default.js'

const defaultPath = path.join(process.cwd(), 'config')

/**
 * Returns the config after reading, processing, and validating it.
 * @param {string} configPath
 * @param {string} loglevel
 * @return {Promise<Config>}
 */
export default async function get(configPath, loglevel) {
  log.setLevel(loglevel)
  configPath = findConfig(configPath, log)
  let config = await readConfig(configPath, log)
  applyGlobalConfig(config)
  applyDrivers(config)
  applyGroups(config)
  validateConfig(config, log)
  return config
}

/**
 * Check if this directory, file, or a file with a .js or .json extension exists and return a resolved path to it.
 * If no path is given, the default path is returned.
 * @param {string} configPath The path to the configuration file or directory.
 * @param {Logger} log The logger object to use for logging.
 * @return {string} The resolved path to the configuration file or directory.
 */
export function findConfig(configPath, log) {
  log.trace('Looking for config with path', configPath)
  if (typeof configPath !== 'string' || configPath.trim().length === 0) {
    log.debug(`No config path given, using default path ${defaultPath}`)
    configPath = defaultPath
  }
  if (fs.existsSync(configPath)) {
    log.debug(`Using config path ${configPath}`)
    return path.resolve(configPath)
  }
  const extensions = ['.js', '.json']
  for (const extension of extensions) {
    const pathWithExtension = configPath + extension
    if (fs.existsSync(pathWithExtension)) {
      log.debug(`Using config path ${pathWithExtension}`)
      return path.resolve(pathWithExtension)
    }
  }
  log.debug(
    `No file or directory found at config path, using default path ${defaultPath}`
  )
  return defaultPath
}

/**
 * Reads the configuration from the file system based on a given path. Depending on whether the path is a file or
 * directory, the configuration is parsed and processed here into a single combined json object.
 *
 * @param {string} configPath The path to the configuration file or directory.
 * @param {Logger} log The logger object to use for logging.
 * @return {Config} The configuration object built from the file system or a default configuration if there are errors.
 */
export async function readConfig(configPath, log) {
  let config
  if (fs.existsSync(configPath)) {
    const stats = fs.statSync(configPath)
    if (stats.isDirectory()) {
      config = await readConfigDirectory(configPath)
    } else if (stats.isFile()) {
      config = await readConfigFile(configPath)
    }
  } else {
    log.error(`Configuration path ${configPath} does not exist.`)
    throw new Error(`Configuration path ${configPath} does not exist.`)
  }
  return deepMerge(defaultConfig, config)
}

/**
 * Reads the configuration from a directory and returns a json object. Directories will be parsed recursively to build
 * the configuration object, using directory and file names as keys.
 * @param {string} configPath The path to the directory containing the configuration files.
 * @return {object} The configuration object built from the directory structure.
 */
export async function readConfigDirectory(configPath) {
  const config = {}
  const files = fs.readdirSync(configPath)
  for (const file of files) {
    const filePath = path.join(configPath, file)
    const stats = await fs.statSync(filePath)
    if (stats.isDirectory()) {
      config[file] = await readConfigDirectory(filePath)
    } else if (stats.isFile()) {
      config[file] = await readConfigFile(filePath)
    }
  }
  return config
}

/**
 * Reads the configuration from a file and returns a json object. The file can be either a json file or a javascript.
 * @param {string} configPath
 * @return {object}
 */
export async function readConfigFile(configPath) {
  if (configPath.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(configPath, {encoding: 'utf8'}))
  }
  const module = await import(configPath)
  return module.default || module
}

/**
 * Applies the global driver configuration to map agents.
 * @param {Config} config The configuration object as it was read from the file system.
 */
export function applyGlobalConfig(config) {
  if (config.global?.agents) {
    for (let agentName in config.agents) {
      config.agents[agentName] = deepMerge(deepMerge({}, config.global.agents), config.agents[agentName])
    }
  }
}

/**
 * Applies the driver configuration to map agents.
 * @param {Config} config The configuration object as it was read from the file system.
 */
export function applyDrivers(config) {
  const {drivers, agents} = config
  if (drivers) {
    for (const agentName in agents) {
      const agentDriver = agents[agentName].driver
      const driverConfig = drivers[agentDriver.type]
      if (driverConfig) {
        agents[agentName].driver = {...driverConfig, ...agentDriver}
      }
    }
  }
}

/**
 * This method first looks for the group property on the config object and applies the group configuration to map agents.
 * Then it scans each agent and adds the agent to the group specified in the agent's configuration. Finally, if there are
 * very similar named groups, it will warn the user that they should be merged.
 * @param {Config} config
 */
export function applyGroups(config) {
  if (config.groups) {
    for (let groupName in config.groups) {
      let group = config.groups[groupName]
      for (let agentName in config.agents) {
        let agent = config.agents[agentName]
        if (!agent.groups) {
          agent.groups = []
        }
        if (group.includes(agentName)) {
          agent.groups.push(groupName)
        }
      }
    }
  }

  for (let agentName in config.agents) {
    let agent = config.agents[agentName]
    if (agent.groups) {
      for (let group of agent.groups) {
        if (!config.groups[group]) {
          config.groups[group] = []
        }
        if (!config.groups[group].includes(agentName)) {
          config.groups[group].push(agentName)
        }
      }
    }
  }
}

/**
 * Validates the configuration object and logs warnings and errors. Throws an Error on invalid configuration.
 * @param {Config} config The configuration object to validate.
 * @param {Logger} log The logger object to use for logging.
 */
export function validateConfig(config, log) {
  // validate agents
  for (let agentName in config.agents) {
    let agent = config.agents[agentName]
    if (!agent.driver.type) {
      log.error(`Agent ${agentName} does not have a driver type specified.`)
      log.trace('Config:', config)
      throw new Error(`Agent ${agentName} does not have a type specified.`)
    }
  }
  if (Object.keys(config.drivers).length === 0) {
    log.error('No drivers configured.')
    log.trace('Config:', config)
    throw new Error('No drivers configured.')
  }
}

/**
 * Merges the source object into the target object recursively.
 * @param {...Object} sources
 */
function deepMerge(...sources) {
  let target = {}
  for (const source of sources) {
    if (source instanceof Array) {
      if (!(target instanceof Array)) {
        target = []
      }
      target = target.concat(source)
    } else if (source instanceof Object) {
      for (const key in source) {
        if (source[key] instanceof Object) {
          if (!target[key]) {
            Object.assign(target, {[key]: {}})
          }
          target[key] = deepMerge(target[key], source[key])
        } else {
          Object.assign(target, {[key]: source[key]})
        }
      }
    }
  }
  return target

}
