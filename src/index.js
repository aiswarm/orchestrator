/**
 * This is the entrypoint into the application. It reads the configuration from the file system and then initializes an
 * api object that is passed to multiple modules along with the configuration for initialization. The system can be run
 * both as a library for an existing application or as a standalone command line application. The system can also be
 * extended via plugins that are added via npm modules. Any modules tagged with the keyword 'ai_so:plugin' will
 * be loaded and initialized automatically. For more information on plugins, see the documentation in the doc folder.
 */
import log from 'loglevel'
import Config from './configParser.js'
import API from '../api.js'
import plugins from './plugins.js'
import GeneratorDriver from './driver.generator.js'
import TimeAndDateSkill from './skills/getTimeAndDate.js'
import GetAgentsAndGroups from './skills/getAgentsAndGroups.js'
import CreateAgent from './skills/createAgent.js'
import CreateGroup from './skills/createGroup.js'
import SendMessage from './skills/sendMessage.js'
import GetSkillInfo from './skills/getSkillInfo.js'

export async function initialize(configPath, loglevel = 'info') {
  log.setLevel(loglevel)
  log.info('Starting AI Swarm Orchestrator')

  const config = await Config(configPath, loglevel)
  let api = API(config, log)

  // Add built-in driver(s)
  api.registerAgentDriver('generator', GeneratorDriver)

  // Add built-in skills
  api.registerAgentSkill(CreateAgent)
  api.registerAgentSkill(GetSkillInfo)
  api.registerAgentSkill(CreateGroup)
  api.registerAgentSkill(TimeAndDateSkill)
  api.registerAgentSkill(GetAgentsAndGroups)
  api.registerAgentSkill(SendMessage)
  api.skills.addSkillCollection('core', api.skills.list().filter(skill => skill !== 'createAgent'))

  // Load 3rd party plugins
  await plugins(api)

  // Set up agents
  api.agents.initialize()

  return {
    run: (prompt) => {
      api.agents.run(prompt)
    }
  }
}
