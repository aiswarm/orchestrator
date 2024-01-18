export default class GetSkillInfo {
  #api
  #config

  constructor({api}) {
    this.#api = api
    this.#config = api.config.skills.getSkillInfo
  }

  get name() {
    return 'Get Skill Info'
  }

  get description() {
    return this.#config.description
  }

  get parameters() {
    return {
      name: {
        type: 'string',
        description: this.#config.parameters.name
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