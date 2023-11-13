/** Reads the configuration from the file system.
 * @description This module reads the configuration from the file system based on a given path. Depending on whether the
 * path is a file or directory, the configuration is parsed and processed here into a single combined json object.
 * Directories will be parsed recursively to build the configuration object, using directory and file names as keys.
 *
 * You can look at the test cases to see examples of configuration files and how they are parsed.
 */

import fs from 'fs';
import path from 'path';
import defaultConfig from './config.default.js';

const defaultPath = path.join(process.cwd(), 'config');

/**
 * Reads the configuration from the file system based on a given path. Depending on whether the path is a file or
 * directory, the configuration is parsed and processed here into a single combined json object.
 *
 * @param {string} configPath The path to the configuration file or directory.
 * @return {object} The configuration object built from the file system or a default configuration if there are errors.
 */
export default async function readConfig(configPath = defaultPath) {
    configPath = path.resolve(configPath);
    let config;
    if (fs.existsSync(configPath)) {
        const stats = fs.statSync(configPath);
        if (stats.isDirectory()) {
            config = await readConfigDirectory(configPath);
        } else if (stats.isFile()) {
            config = await readConfigFile(configPath);
        }
    }
    return Object.assign({}, defaultConfig, config);
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
 * @param configPath
 * @return {object}
 */
export async function readConfigFile(configPath) {
    if (configPath.endsWith('.json')) {
        return JSON.parse(await fs.readFileSync(configPath, 'utf8'));
    }
    return import(configPath);
}