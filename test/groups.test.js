import { vi } from 'vitest'
import { API } from '../src/api.js'
import Groups from '../src/groups.js'

const loglevel = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

function makeApi(initialGroups = {}) {
  return new API({ groups: { ...initialGroups } }, loglevel)
}

describe('Groups', () => {
  // Creating a new group with a name and members adds the group to the configuration and emits a 'created' event.
  it("should add group to configuration and emit 'created' event", () => {
    const api = makeApi()
    const groups = new Groups(api)
    const mockEmit = vi.spyOn(groups, 'emit')
    const groupName = 'group1'
    const members = ['agent1', 'agent2', 'agent3']

    const result = groups.add(groupName, ...members)

    expect(result).toBe(true)
    expect(api.config.groups[groupName]).toEqual(members)
    expect(mockEmit).toHaveBeenCalledWith('created', groupName, members)
  })

  // Adding members to an existing group updates the configuration and emits an 'updated' event.
  it("should update group configuration and emit 'updated' event", () => {
    const initialMembers = ['agent1', 'agent2']
    const api = makeApi({ group1: initialMembers })
    const groups = new Groups(api)
    const mockEmit = vi.spyOn(groups, 'emit')
    const groupName = 'group1'
    const newMembers = ['agent3', 'agent4']

    const result = groups.add(groupName, ...newMembers)

    expect(result).toBe(false)
    expect(api.config.groups[groupName]).toEqual([...initialMembers, ...newMembers])
    expect(mockEmit).toHaveBeenCalledWith('updated', groupName, [...initialMembers, ...newMembers])
  })

  // Removing an existing group removes it from the configuration and emits a 'removed' event.
  it("should remove group from configuration and emit 'removed' event", () => {
    const api = makeApi({ group1: ['agent1', 'agent2'] })
    const groups = new Groups(api)
    const mockEmit = vi.spyOn(groups, 'emit')
    const groupName = 'group1'

    const result = groups.remove(groupName)

    expect(result).toBe(true)
    expect(api.config.groups[groupName]).toBeUndefined()
    expect(mockEmit).toHaveBeenCalledWith('removed', groupName)
  })

  // Retrieving the members of an existing group returns an array of agent names.
  it('should return array of agent names for existing group', () => {
    const members = ['agent1', 'agent2']
    const api = makeApi({ group1: members })
    const groups = new Groups(api)

    const result = groups.get('group1')

    expect(result).toEqual(members)
  })

  // Listing all groups returns an array of group names.
  it('should return array of group names', () => {
    const api = makeApi({ group1: ['agent1', 'agent2'], group2: ['agent3', 'agent4'] })
    const groups = new Groups(api)

    const result = groups.list()

    expect(result).toEqual(['group1', 'group2'])
  })

  // Creating a group with the same name as an existing agent throws an error.
  it('should throw error when creating group with same name as existing agent', () => {
    const api = makeApi()
    const groups = new Groups(api)
    const agentName = 'agent1'
    api.agents.get = vi.fn().mockReturnValue(true)

    expect(() => {
      groups.add(agentName, 'agent2', 'agent3')
    }).toThrowError(`Group ${agentName} already exists as an agent.`)
  })

  // Creating a group with no members creates an empty group.
  it('should create empty group when no members are given', () => {
    const api = makeApi()
    const groups = new Groups(api)
    const groupName = 'group1'

    const result = groups.add(groupName)

    expect(result).toBe(true)
    expect(api.config.groups[groupName]).toEqual([])
  })

  // Mixed-case lookups must succeed because add() lowercases on entry.
  it('forAgent should find groups regardless of input casing', () => {
    const api = makeApi({ team1: ['alice', 'bob'], team2: ['bob', 'carol'] })
    const groups = new Groups(api)

    expect(groups.forAgent('Bob').sort()).toEqual(['team1', 'team2'])
    expect(groups.forAgent('  ALICE  ')).toEqual(['team1'])
    expect(groups.forAgent('nobody')).toEqual([])
    expect(groups.forAgent(undefined)).toEqual([])
  })

  // get() already lowercases; verify it works end-to-end with mixed case.
  it('get should return members regardless of input casing', () => {
    const members = ['agent1', 'agent2']
    const api = makeApi({ team1: members })
    const groups = new Groups(api)

    expect(groups.get('Team1')).toEqual(members)
    expect(groups.get('  TEAM1  ')).toEqual(members)
  })

  // auto() should produce a stable, lowercased group name.
  it('auto should normalize members and produce a stable lowercase group name', () => {
    const api = makeApi()
    const groups = new Groups(api)
    const mockEmit = vi.spyOn(groups, 'emit')

    groups.auto('Bob', 'ALICE', '  carol  ')

    expect(api.config.groups['alice, bob, carol']).toEqual(['alice', 'bob', 'carol'])
    expect(mockEmit).toHaveBeenCalledWith('created', 'alice, bob, carol', ['alice', 'bob', 'carol'])
  })

  // auto() should dedupe members that collapse to the same lowercase name.
  it('auto should dedupe members that collapse to the same name', () => {
    const api = makeApi()
    const groups = new Groups(api)

    groups.auto('Bob', 'bob', '  BOB  ', 'alice')

    expect(api.config.groups['alice, bob']).toEqual(['alice', 'bob'])
  })
})
