export default class GetSkillInfo {
  #api

  constructor({api}) {
    this.#api = api
  }

  get name() {
    return 'getSkillInfo'
  }

  get description() {
    return 'Returns information about a skill, such as its parameters and description'
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: 'The name of the skill to get information about. Returns all skills if not specified'
      }
    }
  }

  get required() {
    return []
  }

  execute({name}) {
    if (name) {
      const skill = this.#api.skills.get(name)
      if (!skill) {
        return `Skill ${name} not found`
      }
      return {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters,
        required: skill.required
      }
    }

    const skills = this.#api.skills.list()
    return skills.map((skillName) => {
      const skill = this.#api.skills.get(skillName)
      return {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters,
        required: skill.required
      }
    })
  }
}