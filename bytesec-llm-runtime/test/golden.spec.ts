import { describe, expect, it, vi, afterEach } from "vitest";
import type { ModelConnection, ModelProvider, StreamEvent } from "../src";
import { createAgent, createModelRegistry, builtinTools } from "../src";

const mockFetch = vi.fn();
vi.mock("undici", () => ({ fetch: mockFetch }));

const fixture = async <T>(path: string): Promise<T> => {
  const file = Bun.file(new URL(path, import.meta.url));
  const text = await file.text();
  return JSON.parse(text) as T;
};

const textFixture = async (path: string) => {
  const file = Bun.file(new URL(path, import.meta.url));
  return file.text();
};

const connectionFromTranscript = (events: ReadonlyArray<StreamEvent>): ModelConnection => {
  const generate = async () => {
    const firstText = events.find((e) => e.type === "text");
    return typeof firstText?.data === "string" ? firstText.data : "";
  };
  const stream = async function* () {
    for (const event of events) {
      yield event;
    }
  };
  return { generate, stream };
};

afterEach(() => {
  mockFetch.mockReset();
});

describe("golden transcripts", () => {
  it("matches stream events", async () => {
    const transcript = await fixture<StreamEvent[]>("./fixtures/stream.json");
    const provider: ModelProvider = {
      id: "golden",
      name: "Golden",
      connect: async () => connectionFromTranscript(transcript),
    };
    const models = createModelRegistry([provider]);
    const agent = createAgent({ models, model: { provider: "golden", config: { model: "x" } } });
    const observed: StreamEvent[] = [];
    for await (const event of agent.stream("hi")) {
      observed.push(event as StreamEvent);
    }
    expect(observed).toEqual(transcript);
  });
});

describe("fetch tool conversion", () => {
  it("converts HTML to markdown", async () => {
    const html = "<html><body><h1>Title</h1><p><strong>Bold text</strong> with link to <a href=\"https://example.com\">example</a></p><ul><li>item one</li><li>item two</li></ul></body></html>";
    mockFetch.mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const expected = await textFixture("./fixtures/fetch_markdown.txt");
    const result = await builtinTools.fetchTool.execute({ url: "https://example.com", format: "markdown" }, {});
    expect(result.output).toBe(expected.trim());
  });
});
