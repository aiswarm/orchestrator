import Agent from '../src/agent.js';

describe('Agent', () => {
  let agent;
  let mockDriver;

  beforeEach(() => {
    mockDriver = {
      instruct: jest.fn().mockResolvedValue('instruction result')
    };
    agent = new Agent('testAgent', mockDriver);
  });

  describe('constructor', () => {
    it('should initialize with the correct name and driver', () => {
      expect(agent.name).toBe('testAgent');
      expect(agent.driver).toBe(mockDriver);
    });
  });

  describe('instruct', () => {
    it('should call the driver instruct method with the correct prompt', async () => {
      const prompt = 'test prompt';
      const result = await agent.instruct(prompt);
      expect(mockDriver.instruct).toHaveBeenCalledWith(prompt);
      expect(result).toBe('instruction result');
    });
  });
});