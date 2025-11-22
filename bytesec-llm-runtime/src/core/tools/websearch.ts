import { z } from "zod";
import type { Tool } from "../../types";

type Fetcher = typeof fetch;

const formatResults = (items: ReadonlyArray<{ title: string; body: string; url?: string }>, query: string) => {
  if (items.length === 0) {
    return `No search results found for: ${query}`;
  }
  const lines = items.slice(0, 8).map((item, index) => {
    const title = item.title || `Result ${index + 1}`;
    const url = item.url ? ` (${item.url})` : "";
    return `- ${title}${url}\n${item.body}`;
  });
  return lines.join("\n\n");
};

const parseDuck = (data: any) => {
  const topics = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
  const primary = topics
    .map((t: any) => {
      const title = typeof t.Text === "string" ? t.Text : undefined;
      const url = typeof t.FirstURL === "string" ? t.FirstURL : undefined;
      const body = title ?? "";
      return title ? { title, body, url } : undefined;
    })
    .filter(Boolean) as Array<{ title: string; body: string; url?: string }>;

  if (primary.length > 0) return primary;

  const text = typeof data.AbstractText === "string" ? data.AbstractText : "";
  const url = typeof data.AbstractURL === "string" ? data.AbstractURL : undefined;
  if (text) return [{ title: data.Heading ?? "Result", body: text, url }];
  return [];
};

const description = `Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs
- Provides up-to-date information for current events and recent data
- Supports configurable result counts and returns the content from the most relevant websites
- Use this tool for accessing information beyond knowledge cutoff
- Searches are performed automatically within a single API call

Usage notes:
  - Supports live crawling modes: 'fallback' (backup if cached unavailable) or 'preferred' (prioritize live crawling)
  - Search types: 'auto' (balanced), 'fast' (quick results), 'deep' (comprehensive search)
  - Configurable context length for optimal LLM integration
  - Domain filtering and advanced search options available`;

export const createWebSearchTool = (doFetch: Fetcher = fetch): Tool => ({
  name: "websearch",
  description,
  parameters: z.object({
    query: z.string().describe("Websearch query"),
    numResults: z.number().optional().describe("Number of search results to return (default: 8)"),
    livecrawl: z.enum(["fallback", "preferred"]).optional(),
    type: z.enum(["auto", "fast", "deep"]).optional(),
    contextMaxCharacters: z.number().optional(),
  }),
  execute: async (args) => {
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", args.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_redirect", "1");
    url.searchParams.set("no_html", "1");
    const res = await doFetch(url.toString());
    if (!res.ok) {
      throw new Error(`Web search failed: ${res.status}`);
    }
    const json = await res.json();
    const items = parseDuck(json);
    const output = formatResults(items.slice(0, args.numResults ?? 8), args.query);
    return {
      title: `Web search: ${args.query}`,
      output,
      metadata: { results: items },
    };
  },
});
