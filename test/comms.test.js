import Communications from "../src/comms.js";

describe("Communications", () => {
  let api, comms;

  beforeEach(() => {
    api = {
      config: {
        comms: {
          historySize: 10,
        },
      },
    };
    comms = new Communications(api);
  });

  afterEach(() => comms.destroy());

  it("should add an instance of Communications", () => {
    expect(comms).toBeInstanceOf(Communications);
  });

  it("should get history correctly", () => {
    expect(comms.history).toEqual([]);
  });

  it("should emit a messageInput correctly", () => {
    comms.emit("target", "source", "content", Communications.Message.videoType);
    expect(comms.history[0].target).toBe("target");
    expect(comms.history[0].source).toBe("source");
    expect(comms.history[0].content).toBe("content");
    expect(comms.history[0].type).toBe(Communications.Message.videoType);
  });

  it("should add a messageInput correctly", () => {
    const message = comms.createMessage("target", "source", "content");
    expect(message.target).toBe("target");
    expect(message.source).toBe("source");
    expect(message.content).toBe("content");
  });
});
