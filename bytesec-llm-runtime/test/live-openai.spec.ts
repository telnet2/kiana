import { describe, expect, it } from "vitest";
import { createAgent, createModelRegistry, openAIProvider } from "../src";
import type { StreamEvent } from "../src";

const hasKey = Boolean(Bun.env.OPENAI_API_KEY);
const describeLive = hasKey ? describe : describe.skip;
const timeout = 20000;

const modelId = Bun.env.MYCODE_OPENAI_MODEL ?? "gpt-4o-mini";

describeLive("live openai", () => {
  it("responds with text", async () => {
    const models = createModelRegistry([openAIProvider]);
    const agent = createAgent({
      models,
      model: {
        provider: "openai",
        config: {
          model: modelId,
          apiKey: Bun.env.OPENAI_API_KEY,
        },
      },
    });
    const result = await agent.respond("Say hi in one short sentence.");
    expect(result.text.length).toBeGreaterThan(0);
  }, timeout);

  it("streams events", async () => {
    const models = createModelRegistry([openAIProvider]);
    const agent = createAgent({
      models,
      model: {
        provider: "openai",
        config: {
          model: modelId,
          apiKey: Bun.env.OPENAI_API_KEY,
        },
      },
    });
    const events: string[] = [];
    for await (const event of agent.stream("Say hi.") as AsyncIterable<StreamEvent>) {
      if (event.type === "text" && typeof event.data === "string") {
        events.push(event.data);
      }
    }
    expect(events.length).toBeGreaterThan(0);
  }, timeout);
});
