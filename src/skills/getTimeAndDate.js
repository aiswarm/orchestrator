/**
 * @type {AgentSkill} TimeAndDateSkill
 */
export default class TimeAndDateSkill {
  #api
  #config

  constructor({api}) {
    this.#api = api
    this.#config = api.config.skills.getTimeAndDate
  }

  get name() {
    return 'get_time_date'
  }

  get description() {
    return this.#config.description
  }

  get parameters() {
    return {
      format: {
        type: 'string',
        description: this.#config.parameters.format
      }
    }
  }

  get required() {
    return ['format']
  }

  execute({format}) {
    return formatDate(new Date(), format)
  }
}

/**
 * Formats a date according to UTS#35 date format patterns.
 * @param {Date} date The date to format
 * @param {string} format The format to use
 * @return {string} The formatted date
 */
function formatDate(date, format) {
  const options = { timeZoneName: 'short' }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  const timeZonePart = parts.find(part => part.type === 'timeZoneName')

  const map = {
    'yyyy': date => date.getFullYear(),
    'yy': date => String(date.getFullYear()).slice(-2),
    'MM': date => String(date.getMonth() + 1).padStart(2, '0'),
    'dd': date => String(date.getDate()).padStart(2, '0'),
    'HH': date => String(date.getHours()).padStart(2, '0'),
    'mm': date => String(date.getMinutes()).padStart(2, '0'),
    'ss': date => String(date.getSeconds()).padStart(2, '0'),
    'SSS': date => String(date.getMilliseconds()).padStart(3, '0'),
    'E': date => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
    'D': date => String(date.getDate()),
    'F': date => Math.ceil((date.getDate() + 1) / 7),
    'w': date => {
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
      const pastDaysOfYear = (date - firstDayOfYear) / 86400000
      return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
    },
    'W': date => {
      const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const pastDaysOfMonth = (date - firstDayOfMonth) / 86400000
      return Math.ceil((pastDaysOfMonth + firstDayOfMonth.getDay() + 1) / 7)
    },
    'MMM': date => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()],
    'MMMM': date => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()],
    'a': date => date.getHours() < 12 ? 'AM' : 'PM',
    'h': date => date.getHours() % 12 || 12,
    'K': date => date.getHours() % 12,
    'k': date => date.getHours() || 24,
    'H': date => date.getHours(),
    'm': date => date.getMinutes(),
    's': date => date.getSeconds(),
    'S': date => Math.floor(date.getMilliseconds() / 100),
    'z': () => timeZonePart ? timeZonePart.value : '',
    'Z': date => -(date.getTimezoneOffset() < 0 ? '-' : '+') + Math.abs(date.getTimezoneOffset() / 60).toFixed(2)
  }

  return format.replace(/yyyy|yy|MM|dd|HH|mm|ss|SSS|E|D|F|w|W|MMM|MMMM|a|h|K|k|H|m|s|S|z|Z/g, matched => map[matched](date))
}