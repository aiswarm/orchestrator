# AI Swarm - Orchestrator

## Overview

The orchestrator is the main component of the AI Swarm. It is responsible for managing the agents and their skills, and for orchestrating the communication between them.

This project is currently in a very early stage and is not ready for use beyond exploratory development.

If you're looking for an easy way to get started with the AI Swarm, check out the [Conductor](https://github.com/aiswarm/conductor) project.

## Getting Started

This project is split into multiple packages that are loaded as plugins by the orchestrator.  This allows developers to choose which plugins they want to use and to create their own plugins based on the examples provided here. The goal is to provide a basic functionality that can be extended by the community.

Once published you can find the plugins on npm with the `@aiswarm:plugin` keyword. Installed plugins are automatically loaded by the orchestrator when they're installed.

The orchestrator is the core of the AI Swarm and is responsible for managing the agents and their skills, and for orchestrating the communication between them and the user. It's designed to be able to run in both a browser and a node.js environment. Local file access is provided through the ui-cli project.
