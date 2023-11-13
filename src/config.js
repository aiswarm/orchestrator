/** Reads the configuration from the file system.
 * @description This module reads the configuration from the file system based on a given path. Depending on whether the
 * path is a file or directory, the configuration is parsed and processed here into a single combined json object.
 * Directories will be parsed recursively to build the configuration object, using directory and file names as keys.
 *
 * You can look at the test cases to see examples of configuration files and how they are parsed.
 */

import fs from 'fs';
import path from 'path';
import logger from 'console-log-level';

import defaultConfig from './config.default.js';

const defaultPath = path.join(process.cwd(), 'config');


/**
 * Reads the configuration from the file system based on a given path. Depending on whether the path is a file or
 * directory, the configuration is parsed and processed here into a single combined json object.
 *
 * @param {string} configPath The path to the configuration file or directory.
 * @param {string} loglevel The log level to use for logging.
 * @return {object} The configuration object built from the file system or a default configuration if there are errors.
 */
export default async function readConfig(configPath, loglevel ) {
    const log = logger({level: loglevel});
    configPath = findConfig(configPath, log);

    let config;
    if (fs.existsSync(configPath)) {
        const stats = fs.statSync(configPath);
        if (stats.isDirectory()) {
            config = await readConfigDirectory(configPath);
        } else if (stats.isFile()) {
            config = await readConfigFile(configPath);
        }
    } else {
        log.error(`Configuration path ${configPath} does not exist.`);
        process.exit(1);
    }

    config = Object.assign({}, defaultConfig, config);
    config = applyGlobalConfig(config);
    log.trace('Configuration:', config);
    return config;
}

/**
 * Applies the global driver configuration to all agents.
 * @param {Config} config The configuration object as it was read from the file system.
 * @return {Config} The configuration object with the global driver configuration applied to all agents.
 */
export function applyGlobalConfig(config) {
    if (config.global?.driver) {
        for (let agent in config.agents) {
            config.agents[agent].driver = Object.assign({}, config.global.driver, config.agents[agent].driver);
        }
    }
    return config;
}

/**
 * Check if this directory, file, or a file with a .js or .json extension exists and return a resolved path to it.
 * If no path is given, the default path is returned.
 * @param {string }configPath The path to the configuration file or directory.
 *
 * @return {string} The resolved path to the configuration file or directory.
 */
export function findConfig(configPath, log) {
    log.trace('Looking for config with path', configPath);
    if (!configPath || typeof configPath !== 'string' || configPath.trim().length === 0) {
        log.debug(`No config path given, using default path ${defaultPath}`);
        configPath = defaultPath;
    }
    if (fs.existsSync(configPath)) {
        log.debug(`Using config path ${configPath}`);
        return path.resolve(configPath);
    }
    const extensions = ['.js', '.json'];
    for (const extension of extensions) {
        const pathWithExtension = configPath + extension;
        if (fs.existsSync(pathWithExtension)) {
            log.debug(`Using config path ${pathWithExtension}`);
            return path.resolve(pathWithExtension);
        }
    }
    log.debug(`No config path given, using default path ${defaultPath}`);
    return defaultPath;
}

/**
 * Reads the configuration from a directory and returns a json object. Directories will be parsed recursively to build
 * the configuration object, using directory and file names as keys.
 * @param {string} configPath The path to the directory containing the configuration files.
 * @return {object} The configuration object built from the directory structure.
 */
export async function readConfigDirectory(configPath) {
    const config = {};
    const files = fs.readdirSync(configPath);
    for (const file of files) {
        const filePath = path.join(configPath, file);
        const stats = await fs.statSync(filePath);
        if (stats.isDirectory()) {
            config[file] = await readConfigDirectory(filePath);
        } else if (stats.isFile()) {
            config[file] = await readConfigFile(filePath);
        }
    }
    return config;
}

/**
 * Reads the configuration from a file and returns a json object. The file can be either a json file or a javascript.
 * @param {string} configPath
 * @return {object}
 */
export async function readConfigFile(configPath) {
    if (configPath.endsWith('.json')) {
        return JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8'}));
    }
    const module = await import(configPath);
    return module.default || module;
}