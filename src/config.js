/** Reads the configuration from the file system.
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
 * @property {Object} global The global configuration object. Settings here will be applied to all settings of their respective groups.
 * @property {AgentConfig} global.agents The global agent configuration object. Settings here will be applied to all agents.
 * @property {DriverConfig} drivers The driver configuration object. Keys are driver types, values are driver configuration objects.
 * @property {Object.<string, string[]>} groups Groups of agents, keys are group names, values are lists of agent names or types.
 * @property {Object.<string, AgentConfig>} agents Agents to create on startup, keys are agent names, values are agent configuration objects.
 */


import fs from 'fs'
import path from 'path'
import logger from 'console-log-level'

import defaultConfig from './config.default.js'

const defaultPath = path.join(process.cwd(), 'config')

/**
 * Reads the configuration from the file system based on a given path. Depending on whether the path is a file or
 * directory, the configuration is parsed and processed here into a single combined json object.
 *
 * @param {string} configPath The path to the configuration file or directory.
 * @param {string} loglevel The log level to use for logging.
 * @return {object} The configuration object built from the file system or a default configuration if there are errors.
 */
export default async function readConfig(configPath, loglevel) {
  const log = logger({level: loglevel})
  configPath = findConfig(configPath, log)

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
    process.exit(1)
  }

  config = Object.assign({}, defaultConfig, config)
  applyGlobalConfig(config)
  applyDrivers(config)
  applyGroups(config)
  validateConfig(config, log)
  log.trace('Configuration:', config)
  return config
}

/**
 * Check if this directory, file, or a file with a .js or .json extension exists and return a resolved path to it.
 * If no path is given, the default path is returned.
 * @param {string} configPath The path to the configuration file or directory.
 * @param {Object} log The logger object to use for logging.
 * @return {string} The resolved path to the configuration file or directory.
 */
export function findConfig(configPath, log) {
  log.trace('Looking for config with path', configPath)
  if (!configPath || typeof configPath !== 'string' || configPath.trim().length === 0) {
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
  log.debug(`No config path given, using default path ${defaultPath}`)
  return defaultPath
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
 * Applies the global driver configuration to all agents.
 * @param {Config} config The configuration object as it was read from the file system.
 * @return {Config} The configuration object with the global driver configuration applied to all agents.
 */
export function applyGlobalConfig(config) {
  if (config.global?.agents) {
    for (let agentName in config.agents) {
      let agent = config.agents[agentName]
      agent.driver = Object.assign({}, config.global.agents.driver, agent.driver)
    }
  }
}

/**
 * Applies the driver configuration to all agents.
 * @param {Config} config The configuration object as it was read from the file system.
 */
export function applyDrivers(config) {
  if (config.drivers) {
    for (let agentName in config.agents) {
      let agent = config.agents[agentName]
      let driverConfig = config.drivers[agent.type]
      if (driverConfig) {
        agent.driver = Object.assign({}, driverConfig, agent.driver)
      }
    }
  }
}

/**
 * This method first looks for the group property on the config object and applies the group configuration to all agents.
 * Then it scans each agent and adds the agent to the group specified in the agent's configuration. Finally, if there are
 * very similar named groups, it will warn the user that they should be merged.
 * @param config
 */
export function applyGroups(config) {
  if (config.groups) {
    for (let groupName in config.groups) {
      let group = config.groups[groupName]
      for (let agentName in config.agents) {
        let agent = config.agents[agentName]
        if (!agent.group) {
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
 * Validates the configuration object and logs warnings and errors. Ends the process if there are fatal errors.
 * @param {Config} config The configuration object to validate.
 * @param {Object} log The logger object to use for logging.
 */
function validateConfig(config, log) {
  // validate agents
  for (let agentName in config.agents) {
    let agent = config.agents[agentName]
    if (!agent.type) {
      log.error(`Agent ${agentName} does not have a type specified.`)
      process.exit(1)
    }
    if (!config.drivers[agent.type]) {
      log.error(`Agent ${agentName} has an unknown type ${agent.type}.`)
      process.exit(1)
    }
  }
  if (Object.keys(config.drivers).length === 0) {
    log.error('No drivers configured.')
    process.exit(1)
  }
}