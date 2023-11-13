/**
 * This is the command line interface for the swarm orchestration system. It handles all the command line arguments and
 * interactions back and forth with the user. The actual logic is handled by the API object and the rest of the code in
 * src/.
 */

import { program } from 'commander'

import {init} from './src/index.js'
/**
 * Parses the arguments to the command line interface and starts the swarm orchestration system.
 * Supports multiple flags e.g. for debugging purposes.
 */
async function start() {
    program
        .option('-c, --config <path>', 'Path to the configuration file or directory. Defaults to ./config.')
        .option('-d, --debug', 'Enable debug mode.')
        .option('-v, --verbose', 'Enable verbose mode. Overrides debug mode.')
        .option('-h, --help', 'Print this help message.')
        .allowUnknownOption(false)
        .allowExcessArguments(false)
        .showHelpAfterError(true)
        .parse(process.argv)

    const options = program.opts()
    options.help && program.help()

    let loglevel = 'info'
    options.debug && (loglevel = 'debug')
    options.verbose && (loglevel = 'trace')

    await init(options.config, loglevel)
}

await start();