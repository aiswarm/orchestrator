/**
 * This file is responsible for loading plugins from the node_modules directory. It scans the directory for modules
 * tagged with the keyword 'ai_so:plugin' and then loads them and initializes them with the configuration and api
 * objects.
 */

import {execSync} from 'child_process'
import fs from 'fs'
import path from 'path'

const nodeModulesPath = path.join(process.cwd(), 'node_modules')
const pluginKeyword = '@aiswarm:plugin'


/**
 * Looks for plugins in the node_modules directory and loads them if they are tagged with the plugin keyword.
 * @param {API} api The api to the swarm orchestration system. A reference to this object will be passed to each plugin.
 */
export default async function loadPlugins(api) {
  let localPackages = []
  if (fs.existsSync(nodeModulesPath)) {
    localPackages = fs.readdirSync(nodeModulesPath).map((file) => {
      return path.join(nodeModulesPath, file)
    })
  }
  let globalPackages = []
  const globalNodeModulesPath = getGlobalNodeModulesPath(api)
  if (fs.existsSync(globalNodeModulesPath)) {
    globalPackages = fs.readdirSync(globalNodeModulesPath).map((file) => {
      return path.join(globalNodeModulesPath, file)
    })
  }

  const paths =  [...localPackages, ...globalPackages]
  if (paths.length === 0) {
    throw new Error('No plugins found in local or global node_modules directory.')
  }

  for (const packagePath of paths) {
    const packageJson = path.join(packagePath, 'package.json')
    if (!fs.existsSync(packageJson)) {
      api.log.trace(
        `Missing package.json in ${packagePath}. Looking for organization scoped plugins.`
      )
      const orgFiles = fs.readdirSync(packagePath)
      if (orgFiles.length === 0) {
        api.log.trace(`No organization scoped plugins found in ${packagePath}.`)
        continue
      }
      for (const orgFile of orgFiles) {
        const orgPluginPath = path.join(packagePath, orgFile)
        const orgPackageJson = path.join(orgPluginPath, 'package.json')
        if (!fs.existsSync(orgPackageJson)) {
          api.log.trace(`Missing package.json in ${orgPluginPath}. Skipping.`)
          continue
        }
        await initialize(api, orgPackageJson)
      }
      continue
    }

    await initialize(api, packageJson)
  }
}

function getGlobalNodeModulesPath(api) {
  try {
    return execSync('npm root -g').toString().trim()
  } catch (error) {
    api.log.debug('Error getting global node_modules directory:', error)
  }
}

async function initialize(api, packageJson) {
  try {
    const packageInfo = JSON.parse(
      fs.readFileSync(packageJson, {encoding: 'utf8'})
    )
    if (!packageInfo.keywords?.includes(pluginKeyword)) {
      api.log.trace(
        `Skipping ${packageInfo.main} because it does not have the ${pluginKeyword} keyword.`
      )
      return
    }

    const main = path.join(path.dirname(packageJson), packageInfo.main)

    // ignore deprecation warnings from plugins
    const originalEmitWarning = process.emitWarning
    process.emitWarning = (warning, type, code) => {
      code !== 'DEP0040' && originalEmitWarning(warning, type, code)
    }
    const module = await import(main)
    process.emitWarning = originalEmitWarning

    if (typeof module.initialize === 'function') {
      module.initialize(api)
      api.log.debug(`Loaded plugin ${packageInfo.name}.`)
    } else if (module.default === 'function') {
      module.default(api)
      api.log.debug(`Loaded plugin ${packageInfo.name}.`)
    } else {
      api.log.error(
        `Plugin ${packageInfo.name} does not have an initialize or default function.`
      )
    }
  } catch (e) {
    const packageName = path.basename(path.dirname(packageJson))
    api.log.error(`Error loading plugin ${packageName}: ${e.message}`)
    api.log.debug(e)
  }
}
