import Communications from '../src/comms.js'
import {jest} from '@jest/globals'

describe('Communications', () => {
  let api, comms

  beforeEach(() => {
    api = {
      config: {
        comms: {
          history: {
            limits: {
                all: 10
            },
          },
        },
      },
      running: true,
      groups: {
          get: jest.fn()
      },
    }
    comms = new Communications(api)
  })

  it('should add an instance of Communications', () => {
    expect(comms).toBeInstanceOf(Communications)
  })

  it('should get history correctly', () => {
    expect(comms.history.all()).toEqual([])
  })

  it('should emit a messageInput correctly', () => {
    comms.emit('target', 'source', 'content', Communications.Message.videoType)
    const message = comms.history.all()[0]
    expect(message.target).toBe('target')
    expect(message.source).toBe('source')
    expect(message.content).toBe('content')
    expect(message.type).toBe(Communications.Message.videoType)
  })

  it('should add a messageInput correctly', () => {
    const message = comms.createMessage('target', 'source', 'content')
    expect(message.target).toBe('target')
    expect(message.source).toBe('source')
    expect(message.content).toBe('content')
  })
})
