import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAgent, createModelRegistry, createToolRegistry } from "../src";
import type { ModelConnection, ModelProvider, StreamEvent } from "../src";

const createMockConnection = (text: string): ModelConnection => {
  const generate = async () => text;
  const stream = async function* () {
    const event: StreamEvent = { type: "text", data: text };
    yield event;
    const done: StreamEvent = { type: "done", data: null };
    yield done;
  };
  return { generate, stream };
};

const mockProvider: ModelProvider = {
  id: "mock",
  name: "Mock",
  connect: async () => createMockConnection("hi"),
};

describe("model registry", () => {
  it("registers and connects to providers", async () => {
    const registry = createModelRegistry();
    registry.register(mockProvider);
    const listed = registry.list();
    expect(listed.map((p) => p.id)).toContain("mock");
    const connection = await registry.connect("mock", { model: "test" });
    const text = await connection.generate("hello");
    expect(text).toBe("hi");
  });

  it("throws on duplicate providers", () => {
    const registry = createModelRegistry([mockProvider]);
    expect(() => registry.register(mockProvider)).toThrow();
  });
});

describe("tool registry", () => {
  const echoTool = {
    name: "echo",
    description: "echo",
    parameters: z.object({ text: z.string() }),
    execute: async (args: { text: string }) => ({ output: args.text }),
  };

  const gatedTool = {
    name: "gated",
    description: "gated",
    parameters: z.object({ ok: z.boolean() }),
    permission: vi.fn(async (args: { ok: boolean }) => args.ok),
    execute: async () => ({ output: "done" }),
  } satisfies ReturnType<typeof createToolRegistry>["list"][number];

  it("validates args and executes", async () => {
    const registry = createToolRegistry([echoTool]);
    const result = await registry.execute("echo", { text: "hey" }, {});
    expect(result.output).toBe("hey");
  });

  it("enforces permissions", async () => {
    const registry = createToolRegistry([gatedTool]);
    await expect(registry.execute("gated", { ok: false }, {})).rejects.toThrow();
    expect(gatedTool.permission).toHaveBeenCalled();
  });

  it("errors on unknown tool", async () => {
    const registry = createToolRegistry([]);
    await expect(registry.execute("missing", {}, {})).rejects.toThrow();
  });
});

describe("agent", () => {
  it("responds using configured provider", async () => {
    const models = createModelRegistry([mockProvider]);
    const agent = createAgent({ models, model: { provider: "mock", config: { model: "x" } } });
    const result = await agent.respond("hi");
    expect(result.text).toBe("hi");
  });

  it("streams events", async () => {
    const models = createModelRegistry([mockProvider]);
    const agent = createAgent({ models, model: { provider: "mock", config: { model: "x" } } });
    const events: StreamEvent[] = [];
    for await (const event of agent.stream("hi")) {
      events.push(event as StreamEvent);
    }
    expect(events.at(0)?.type).toBe("text");
    expect(events.at(-1)?.type).toBe("done");
  });
});
