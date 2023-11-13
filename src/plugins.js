/**
 * This file is responsible for loading plugins from the node_modules directory. It scans the directory for modules
 * tagged with the keyword 'ai_so:plugin' and then loads them and initializes them with the configuration and api
 * objects.
 */

import fs from 'fs';
import path from 'path';

const nodeModulesPath = path.join(process.cwd(), 'node_modules');
const pluginKeyword = 'ai_so:plugin';

/**
 * Looks for plugins in the node_modules directory and loads them if they are tagged with the plugin keyword.
 * @param {API} api The api to the swarm orchestration system. A reference to this object will be passed to each plugin.
 */
export default async function loadPlugins(api) {
    if (!fs.existsSync(nodeModulesPath)) {
        console.error('No node_modules directory found. Please run `npm install` to install dependencies.');
        process.exit(1);
    }

    const files = fs.readdirSync(nodeModulesPath);
    if (files.length === 0) {
        console.error('No plugins found in node_modules directory.');
        process.exit(1);
    }

    for (let file of files) {
        try {
            const pluginPath = path.join(nodeModulesPath, file);
            const packageJson = path.join(pluginPath, 'package.json');
            if (!fs.existsSync(packageJson)) {
                continue;
            }

            const packageInfo = JSON.parse(fs.readFileSync(packageJson, { encoding:'utf8' }));
            if (!packageInfo.keywords?.includes(pluginKeyword)) {
                continue;
            }

            const main = path.join(pluginPath, packageInfo.main);
            const module = await import(main);
            if (typeof module.initialize === 'function') {
                module.initialize(api);
            } else if (module.default === 'function') {
                module.default(api);
            } else {
                console.error(`Plugin ${file} does not have an initialize or default function.`);
            }
        } catch (e) {
            console.error(`Error loading plugin ${file}: ${e}`);
        }
    }
}