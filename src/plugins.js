/**
 * This file is responsible for loading plugins from the node_modules directory. It scans the directory for modules
 * tagged with the keyword 'ai_so:plugin' and then loads them and initializes them with the configuration and api
 * objects.
 */

import fs from 'fs'
import path from 'path'

const nodeModulesPath = path.join(process.cwd(), 'node_modules')
const pluginKeyword = 'ai_so:plugin'

/**
 * Looks for plugins in the node_modules directory and loads them if they are tagged with the plugin keyword.
 * @param {API} api The api to the swarm orchestration system. A reference to this object will be passed to each plugin.
 */
export default async function loadPlugins(api) {
  if (!fs.existsSync(nodeModulesPath)) {
    api.log.error('No node_modules directory found. Please run `npm install` to install dependencies.')
    process.exit(1)
  }

  const files = fs.readdirSync(nodeModulesPath)
  if (files.length === 0) {
    api.log.error('No plugins found in node_modules directory.')
    process.exit(1)
  }

  for (let file of files) {
    if (file.startsWith('.')) {
      api.log.trace(`Skipping ${file} because it starts with a period.`)
      continue
    }
    const pluginPath = path.join(nodeModulesPath, file)
    const packageJson = path.join(pluginPath, 'package.json')
    if (!fs.existsSync(packageJson)) {
      api.log.trace(`Missing package.json in ${pluginPath}. Looking for organization scoped plugins.`)
      const orgFiles = fs.readdirSync(pluginPath)
      if (orgFiles.length === 0) {
        api.log.trace(`No organization scoped plugins found in ${pluginPath}.`)
        continue
      }
      for (let orgFile of orgFiles) {
        const orgPluginPath = path.join(pluginPath, orgFile)
        const orgPackageJson = path.join(orgPluginPath, 'package.json')
        if (!fs.existsSync(orgPackageJson)) {
          api.log.trace(`Missing package.json in ${orgPluginPath}. Skipping.`)
          continue
        }
        await initialize(api, orgPackageJson);
      }
      continue
    }

    await initialize(api, packageJson);
  }
}

async function initialize(api, packageJson) {
  try {
    const packageInfo = JSON.parse(fs.readFileSync(packageJson, {encoding: 'utf8'}))
    if (!packageInfo.keywords?.includes(pluginKeyword)) {
      api.log.trace(`Skipping ${packageInfo.main} because it does not have the ${pluginKeyword} keyword.`)
      return
    }

    const main = path.join(path.dirname(packageJson), packageInfo.main)

    // ignore deprecation warnings from plugins
    const originalEmitWarning = process.emitWarning;
    process.emitWarning = (warning, type, code) => {
      code !== 'DEP0040' && originalEmitWarning(warning, type, code);
    };
    const module = await import(main)
    process.emitWarning = originalEmitWarning;

    if (typeof module.initialize === 'function') {
      module.initialize(api)
      api.log.debug(`Loaded plugin ${packageInfo.name}.`)
    } else if (module.default === 'function') {
      module.default(api)
      api.log.debug(`Loaded plugin ${packageInfo.name}.`)
    } else {
      api.log.error(`Plugin ${packageInfo.name} does not have an initialize or default function.`)
    }
  } catch (e) {
    api.log.error(`Error loading plugin ${packageJson}: ${e}`)
  }
}