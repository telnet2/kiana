import { z } from "zod";
import type { Tool, ToolContext } from "../../types";

const BASE_URL = "https://mcp.exa.ai/mcp";

type ExaContent = {
  readonly type: string;
  readonly text: string;
};

type ExaResponse = {
  readonly jsonrpc: string;
  readonly result?: {
    readonly content: ReadonlyArray<ExaContent>;
  };
};

const formatResults = (items: ReadonlyArray<ExaContent>, query: string) => {
  if (items.length === 0) {
    return `No search results found. Query: ${query}`;
  }
  const lines = items.map((item, idx) => {
    const title = item.type ? `${idx + 1}. ${item.type}` : `${idx + 1}. result`;
    return `${title}\n${item.text}`;
  });
  return lines.join("\n\n");
};

const buildRequest = (params: {
  query: string;
  numResults?: number;
  livecrawl?: "fallback" | "preferred";
  type?: "auto" | "fast" | "deep";
  contextMaxCharacters?: number;
}) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "web_search_exa",
    arguments: {
      query: params.query,
      numResults: params.numResults ?? 8,
      livecrawl: params.livecrawl ?? "fallback",
      type: params.type ?? "auto",
      contextMaxCharacters: params.contextMaxCharacters,
    },
  },
});

const headersFromEnv = () => {
  const apiKey = Bun.env.EXA_API_KEY;
  if (!apiKey) return undefined;
  return { Authorization: `Bearer ${apiKey}` } as const;
};

export const createExaWebSearchTool = (doFetch: typeof fetch = fetch): Tool => ({
  name: "websearch_exa",
  description: "Search the web using Exa MCP endpoint.",
  parameters: z.object({
    query: z.string().describe("Websearch query"),
    numResults: z.number().optional(),
    livecrawl: z.enum(["fallback", "preferred"]).optional(),
    type: z.enum(["auto", "fast", "deep"]).optional(),
    contextMaxCharacters: z.number().optional(),
  }),
  execute: async (args, context?: ToolContext) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const headers = {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(headersFromEnv() ?? {}),
    } as Record<string, string>;

    const response = await doFetch(BASE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequest(args)),
      signal: AbortSignal.any([controller.signal, context?.signal ?? new AbortController().signal]),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Search error (${response.status}): ${message}`);
    }

    const text = await response.text();
    const lines = text.split("\n").filter((line) => line.startsWith("data: "));
    const contents: ExaContent[] = [];
    for (const line of lines) {
      const payload = line.substring(6);
      const parsed = JSON.parse(payload) as ExaResponse;
      const items = parsed.result?.content;
      if (items && items.length > 0) {
        contents.push(...items);
      }
    }

    const output = formatResults(contents, args.query);
    return {
      title: `Web search: ${args.query}`,
      output,
      metadata: { results: contents },
    };
  },
});
