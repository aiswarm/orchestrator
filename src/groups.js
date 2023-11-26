import On from 'onall'

/**
 * Handles all group interactions.
 * @emit Groups#created When a group is created.
 * @emit Groups#updated When a group is updated.
 * @emit Groups#removed When a group is removed.
 */
export default class Groups extends On {
  #api

  constructor(api) {
    super()
    this.#api = api
  }

  /**
   * Creates a new group with the given name and members.  If the group already exists, the members  will be merged with the existing members.
   * An empty group will be created if no members are given.
   * @param {String} name The name of the group.
   * @param {String|String[]} members The members of the group as an array or as a list of arguments.
   * @return {boolean} Returns true if the group was created. False if the group already existed.
   * @throws {Error} Throws an error if the group already exists as an agent.
   * @fires Groups#created
   * @fires Groups#updated
   */
  add(name, ...members) {
    if (this.#api.agents.get(name)) {
      throw new Error(`Group ${name} already exists as an agent.`)
    }
    if (Array.isArray(members[0])) members = members[0]
    if (this.#api.config.groups[name]) {
      this.#api.config.groups[name] = [
        ...new Set([...this.#api.config.groups[name], ...members]),
      ]
      /**
       * @event Groups#updated
       * @type {String} The name of the group.
       * @type {String[]} The members of the group.
       */
      this.emit('updated', name, members)
      return false
    }
    /**
     * @event Groups#created
     * @type {String} The name of the group.
     * @type {String[]} The members of the group.
     */
    this.emit('created', name, members)
    this.#api.config.groups[name] = members ?? []
    return true
  }

  /**
   * Creates a group with the given name and members if it does not already exist.
   * Guarantees consistent group names by sorting the members alphabetically.
   * @param {String} names
   */
  auto(...names) {
    const groupName = names.sort().join(', ')
    this.add(groupName, ...names)
  }

  /**
   * Returns the members of the group with the given name.
   * @param {String} name The name of the group to get.
   * @return {String[]} An array of agent names. Returns undefined if the group does not exist.
   */
  get(name) {
    return this.#api.config.groups[name]
  }

  /**
   * Removes a group with the given name.
   * @param {String} name The name of the group to remove.
   * @return {boolean} Returns true if the group was removed. False if the group did not exist.
   * @fires Groups#removed
   */
  remove(name) {
    if (!this.#api.config.groups[name]) return false
    delete this.#api.config.groups[name]
    /**
     * @event Groups#removed
     * @type {String} The name of the group.
     */
    this.emit('removed', name)
    return true
  }

  /**
   *  Returns an array of group names.
   * @return {String[]}
   */
  list() {
    return this.#api.config.groups.map((group) => group.name)
  }

  /**
   * Returns an object of group names and members.
   * @return {Object.<String,String[]>} An object of group names (keys) and members (array values).
   */
  all() {
    return this.#api.config.groups
  }
}
