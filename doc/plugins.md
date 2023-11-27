# Plugin Reference Documentation

This application is written to be extendable. It's designed to be a platform for experimentation and collaboration. The
plugin system is the primary way that this is accomplished.

If you want to write a plugin, you can find the documentation for that right [here](./plugins.md). Most components of
the system are already written as plugins and are intended to be replaced by better versions eventually.

You can add your own projects and publish your own modules without having to fork the project. You can even publish
your own version of the system with your own plugins and modules.

## Getting Started

To add a plugin for this system, you need to add a new npm project and add the keyword 'ai_so:plugin' to the
package.json file. This will let the system know that this is a plugin, and it will be loaded automatically.

Next you will have to specify the main file for your plugin. This is the file that will be loaded when the system
starts. You can specify this in the package.json file as well. The default is 'index.js'.

Finally, with this setup, when the application starts it will load your plugin and call the `initialize` function. This
is where you can register your plugin with the system. You receive two parameter, the config and an api object that
allows you to interact with the system.

The rest is then up to you. To see how you can interact with the system, you can look at
the [api documentation](./api.md).

## Type of plugins

Depending on what kind of plugin you want to write, you will have to do different things. There are multiple types of
plugins that you can write and each will require you to provide an interface for the system to interact with. All
interactions run through the API object that is passed to the initialize function.

### Agent Drivers

Agent drivers are plugins that allow the system to interact with a specific type of agent. This can be a chatbot, a
voice assistant, or any other type of agent. The system will load map agent drivers and then use them to interact with
the agents that are configured. Each agent will receive a config object that contains the configuration for that agent.  
