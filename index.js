/**
 * This is the command line interface for the swarm orchestration system. It handles all the command line arguments and
 * interactions back and forth with the user. The actual logic is handled by the API object and the rest of the code in
 * src/.
 */

import {init} from './src/index.js'
import { program } from 'commander'

/**
 * Parses the arguments to the command line interface and starts the swarm orchestration system.
 * Supports multiple flags e.g. for debugging purposes.
 */
async function start() {
    program
        .option('-c, --config <path>', 'Path to the configuration file or directory.')
        .option('-d, --debug', 'Enable debug mode.')
        .option('-v, --verbose', 'Enable verbose mode.')
        .parse(process.argv)

    const options = program.opts()
    const configPath = options.config
    const debug = options.debug
    const verbose = options.verbose

    if (debug) {
        console.log('Debug mode enabled.')
    }

    if (verbose) {
        console.log('Verbose mode enabled.')
    }

    await init(configPath)
}

await start();