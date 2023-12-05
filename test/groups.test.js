import API from '../api'
import Groups from '../src/groups'
import {jest} from '@jest/globals'

const config = {
  groups: {}
}

const loglevel = 'error'

describe('Groups', () => {

  // Creating a new group with a name and members adds the group to the configuration and emits a 'created' event.
  it('should add group to configuration and emit \'created\' event', () => {
    const api = new API(config, loglevel)
    const groups = new Groups(api)
    const mockEmit = jest.spyOn(groups, 'emit')
    const groupName = 'group1'
    const members = ['agent1', 'agent2', 'agent3']

    const result = groups.add(groupName, ...members)

    expect(result).toBe(true)
    expect(api.config.groups[groupName]).toEqual(members)
    expect(mockEmit).toHaveBeenCalledWith('created', groupName, members)
  })

  // Adding members to an existing group updates the configuration and emits an 'updated' event.
  it('should update group configuration and emit \'updated\' event', () => {
    const initialMembers = ['agent1', 'agent2']
    const api = new API({...config, groups: {group1: initialMembers}}, loglevel)
    const groups = new Groups(api)
    const mockEmit = jest.spyOn(groups, 'emit')
    const groupName = 'group1'
    const newMembers = ['agent3', 'agent4']
    api.config.groups[groupName] = initialMembers

    const result = groups.add(groupName, ...newMembers)

    expect(result).toBe(false)
    expect(api.config.groups[groupName]).toEqual([...initialMembers, ...newMembers])
    expect(mockEmit).toHaveBeenCalledWith('updated', groupName, [...initialMembers, ...newMembers])
  })

  // Removing an existing group removes it from the configuration and emits a 'removed' event.
  it('should remove group from configuration and emit \'removed\' event', () => {
    const api = new API(config, loglevel)
    const groups = new Groups(api)
    const mockEmit = jest.spyOn(groups, 'emit')
    const groupName = 'group1'
    const members = ['agent1', 'agent2']
    api.config.groups[groupName] = members

    const result = groups.remove(groupName)

    expect(result).toBe(true)
    expect(api.config.groups[groupName]).toBeUndefined()
    expect(mockEmit).toHaveBeenCalledWith('removed', groupName)
  })

  // Retrieving the members of an existing group returns an array of agent names.
  it('should return array of agent names for existing group', () => {
    const api = new API(config, loglevel)
    const groups = new Groups(api)
    const groupName = 'group1'
    const members = ['agent1', 'agent2']
    api.config.groups[groupName] = members

    const result = groups.get(groupName)

    expect(result).toEqual(members)
  })

  // Listing all groups returns an array of group names.
  it('should return array of group names', () => {
    const api = new API(config, loglevel)
    const groups = new Groups(api)
    const group1 = 'group1'
    const group2 = 'group2'
    api.config.groups[group1] = ['agent1', 'agent2']
    api.config.groups[group2] = ['agent3', 'agent4']

    const result = groups.list()

    expect(result).toEqual([group1, group2])
  })

  // Creating a group with the same name as an existing agent throws an error.
  it('should throw error when creating group with same name as existing agent', () => {
    const api = new API(config, loglevel)
    const groups = new Groups(api)
    const agentName = 'agent1'
    api.agents.get = jest.fn().mockReturnValue(true)

    expect(() => {
      groups.add(agentName, 'agent2', 'agent3')
    }).toThrowError(`Group ${agentName} already exists as an agent.`)
  })

  // Creating a group with no members creates an empty group.
  it('should create empty group when no members are given', () => {
    const api = new API(config, loglevel)
    const groups = new Groups(api)
    const groupName = 'group1'

    const result = groups.add(groupName)

    expect(result).toBe(true)
    expect(api.config.groups[groupName]).toEqual([])
  })

})
