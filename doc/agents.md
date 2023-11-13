# Agent Reference Documentation

## Configuration

There are two ways to configure agents and their relationships:
* as a single file all in one, or 
* as a directory structure that mimics the structuer of the json

Note that all properties are optional

Here's what the json looks like:

```json
{
  "global": {
    "instruction": "This instruction will be prepended to all agents' instructions."
  },
  "groups": {
    "group 1": ["agent 1", "agent 2"]
  },
  "agents": {
    "<name of agent 1>": {
      "entrypoint": true,
      "description": "This describes the king of work that this agent does.it translates to system instructions for this agent.",
      "instruction": "The initial instruction for this agent.",
      "groups": ["admins"],
      "creator": true,
      "isolate": false,
      "driver": {
        "type": "openai",
        "model": "gpt-4-turbo",
        "temperature": 0.9,
        "max_tokens": 100,
        "flags": {
          "browse": true,
          "generate": true,
          "analyze": true
        }
      }
    },
    "<name of agent 2>": {
    }
  }
}
```

### Global Properties
These settings will be applied to all agents and have an effect on the system as a whole.
If you can't find a property here, it's probably in the agent properties section, ... or I just forgot to document it. (Please create an issue if you think that's the case.)

### Groups
This is for communication control purposes. It let's you reference groups instead of individuals to make it easier to manage communication.

You can mix and match between groups specified here and groups specified on the agent. The system will merge them together. It's up to you to organize your groups in a way that makes sense.


### Agent Properties

This is where you define the agents and their properties. The properties are as follows:

* `entrypoint` - This is the agent that will be used to start the system. There can be multiple entrypoints to the system, and all of them will be started. If you don't specify an entrypoint, every agent will receive the instruction to start the system. Note that the order in which they will be started is not guaranteed. (Please create an issue if you think that's a feature you need.)
* `description` - This is a description of the agent. It's used to generate the documentation for the agent. It's also used to generate the system instructions for the agent. Think of it as a job description.
* `instruction` - This is a set of instruction that will be sent to the agent. If the agent was created by another agent, this instruction will prepend the instruction that was sent to create the agent. If it is an entrypoint, it will be prepended to the instruction to start the system.
* `groups` - This is a list of groups that the agent belongs to. It's used for communication control purposes. You can mix and match between groups specified here and groups specified in the groups section. The system will merge them together. It's up to you to organize your groups in a way that makes sense.
* `creator` - This is a boolean that indicates whether the agent is allowed to create other agents. If you don't specify this, it will default to false.
* `isolate` - This is a boolean that indicates whether the agent should be isolated from the rest of the system. It means that it will not communicate with any other agents and only work in its own context. An isolated agents can not create other agents. If you don't specify this, it will default to false.
* `driver` - This allows you to fine tune settings for each agent and which driver it uses. The default driver is the openai driver. The properties are as follows:
  * `type` - This is the type of driver to use. The default is `openai`. The only other option is `local`. This is used for testing purposes.
  * `model` - This is the model to use. The default is `gpt-4-turbo`. The only other option is `gpt-3`. This is used for testing purposes.
  * `temperature` - This is the temperature to use. The default is `0.9`. This is used for testing purposes.
  * `max_tokens` - This is the maximum number of tokens to use. The default is `100`. This is used for testing purposes.
  * `flags` - This is a set of flags that can be used to control the driver. By default all flags are set to `true`. The flags are as follows:
    * `browse` - This is a boolean that indicates whether the driver should open a browser window. The default is `true`.
    * `generate` - This is a boolean that indicates whether the driver should generate text. The default is `true`.
    * `analyze` - This is a boolean that indicates whether the driver should analyze text. The default is `true`.