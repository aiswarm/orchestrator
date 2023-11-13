/** This is the entrypoint into the application. It reads the configuration from the file system and then initializes an
 * api object that is passed to multiple modules along with the configuration for initialization. The system can be run
 * both as a library for an existing application or as a standalone command line application. The system can also be
 * extended via plugins that are added via npm modules. Any modules tagged with the keyword 'ai_so:plugin' will
 * be loaded and initialized automatically. For more information on plugins, see the documentation in the doc folder.
 */
import logger from 'console-log-level'
import Config from './config.js';
import API from './api.js';
import plugins from './plugins.js';
import AgentMan from './agentMan.js';

export async function init(configPath, loglevel = 'info') {
    let log = logger({level: loglevel});
    log.info('init');

    // Load 3rd party plugins
    const config = await Config(configPath, loglevel)
    const api = API(config, loglevel);
    await plugins(api)

    // load our plugins
    const agentMan = new AgentMan(api)
    agentMan.run('Stub Instructions');
}