import path from 'path'
import {applyDrivers, applyGlobalConfig, applyGroups, findConfig, readConfig, validateConfig} from '../src/config.js'

const logOn = false
const logFn = logOn ? console.log : () => {
}
const log = {
  trace: logFn,
  debug: logFn,
  info: logFn,
  warn: logFn,
  error: logFn,
};

describe('config.js', () => {
  afterEach(() => {
    jest.resetAllMocks()
  });

  describe('happy path', () => {
    const happyFile = path.join(process.cwd(), 'test/configs/happy.json');

    it('finds a configuration file', async () => {
      const result = findConfig(happyFile, log);
      expect(result).toBe(happyFile);
    });

    it('reads the configuration file from the file system', async () => {
      const result = await readConfig(happyFile, log);
      expect(result.global.agents.driver.type).toBe('openai');
    });

    it('applies the globals from the configuration to the individual sections', async () => {
      const config = {
        global: {
          agents: {
            create: true,
            driver: {
              type: 'openai'
            }
          }
        },
        agents: {
          test: {
            instructions: 'test',
          }
        }
      }
      applyGlobalConfig(config)
      expect(config.agents.test.create).toBe(true);
      expect(config.agents.test.driver.type).toBe('openai');
    });

    it('applies the drivers from the configuration to the agents', async () => {
      const config = {
        drivers: {
          openai: {
            apiKey: 'test',
          }
        },
        agents: {
          test: {
            instructions: 'test',
            driver: {
              type: 'openai'
            }
          }
        }
      }
      applyDrivers(config)
      expect(config.agents.test.driver.apiKey).toBe('test');
    });

    it('applies the groups from the configuration to the agents and vice versa', async () => {
      const config = {
        groups: {
          group1: ['test']
        },
        agents: {
          test: {
            instructions: 'test',
            groups: ['group2']
          }
        }
      }
      applyGroups(config)
      expect(config.agents.test.groups).toContain('group1');
      expect(config.groups.group2).toContain('test');
    });

    it('validates a minimal configuration', async () => {
      const config = {
        drivers: {
          openai: {
            apiKey: 'test',
          }
        },
        agents: {
          test: {
            instructions: 'test',
            driver: {
              type: 'openai'
            }
          }
        }
      }
      validateConfig(config, log)
    });
  });
});