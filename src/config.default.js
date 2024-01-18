/**
 * This is the default configuration file for the app.
 * @class Config
 */
const config = {
  global: {
    agents: {
      driver: {
        type: 'generator'
      },
      groups: []
    }
  },
  comms: {
    history: {
      limits: {
        all: 100_000,
        individual: 10_000
      }
    }
  },
  skills: {
    createAgent: {
      description: 'Creates a new agent that you can communicate with via sendMessage.',
      parameters: {
        name: 'The name of the agent to create',
        driver: 'The type of driver to use for the agent.',
        description: 'A description of the agent',
        instructions: 'Initial Instructions for the agent to follow',
        skills: 'An array of skills to assign to the agent'
      }
    },
    createGroup: {
      description: 'Creates a new group that you can send messages to. Agents can be added to the group later.',
      parameters: {
        name: 'The name of group to create',
        members: 'The names of agents to add to the group'
      }
    },
    getAgentsAndGroups: {
      description: 'Returns users or groups that you can send messages to. Names are unique across both collections and case sensitive',
      parameters: {
        name: 'The name of the user or group to return. An agent name will return info about the agent, a group name will return all members of that group, Leaving this empty will return all users and groups for lookup purposes'
      }
    },
    getSkillInfo: {
      description: 'Returns information about a skill, such as its parameters and description',
      parameters: {
        name: 'The name of the skill to get information about. Returns all skills if not specified'
      }
    },
    getTimeAndDate: {
      description: 'Returns the current time and date in the specified format',
      parameters: {
        format: 'Specifies the date/time using UTS#35 date format patterns.'
      }
    },
    sendMessage: {
      description: 'Sends a message to an agent or group',
      parameters: {
        target: 'The name of the agent or group to send the message to',
        message: 'The message to send',
        type: 'Can be ignored for now, defaults to "string" which is the only format we support at this point.'
      }
    }
  },
  drivers: {
    generator: {
      interval: 5000
    }
  },
  agents: {},
  groups: {}
}
export default config
