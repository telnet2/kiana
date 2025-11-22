import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../src";
import { multiEditTool } from "../src/core/tools/multiedit";
import { patchTool } from "../src/core/tools/patch";
import { createWebSearchTool } from "../src/core/tools/websearch";
import { createBatchTool } from "../src/core/tools/batch";
import { createExaWebSearchTool } from "../src/core/tools/websearch-exa";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempFile = async (content: string) => {
  const dir = await mkdtemp(join(tmpdir(), "tool-test-"));
  const filePath = join(dir, "file.txt");
  await Bun.write(filePath, content);
  return { dir, filePath };
};

describe("multiedit tool", () => {
  it("applies edits", async () => {
    const { dir, filePath } = await tempFile("hello world");
    try {
      const registry = createToolRegistry([multiEditTool]);
      const result = await registry.execute(
        "multiedit",
        {
          filePath,
          edits: [
            { filePath, oldString: "world", newString: "bun" },
            { filePath, oldString: "hello", newString: "hi" },
          ],
        },
        { workingDir: dir }
      );
      expect(result.output.trim()).toBe("hi bun");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("patch tool", () => {
  it("applies unified diff", async () => {
    const { dir, filePath } = await tempFile("one\ntwo\n");
    const rel = "file.txt";
    const patch = `--- a/${rel}\n+++ b/${rel}\n@@ -1,2 +1,3 @@\n one\n two\n+three\n`;
    try {
      const registry = createToolRegistry([patchTool]);
      const result = await registry.execute("patch", { patchText: patch }, { workingDir: dir });
      expect(result.title).toContain("files changed");
      const updated = await Bun.file(filePath).text();
      expect(updated.includes("three")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("websearch tool", () => {
  it("formats results", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          RelatedTopics: [
            {
              Text: "Example result",
              FirstURL: "https://example.com",
            },
          ],
        })
      );
    const tool = createWebSearchTool(fakeFetch as any);
    const registry = createToolRegistry([tool]);
    const result = await registry.execute("websearch", { query: "test" }, {});
    expect(result.output).toContain("Example result");
  });

  it("parses exa responses", async () => {
    const mockLines = [
      "data: " +
        JSON.stringify({
          jsonrpc: "2.0",
          result: { content: [{ type: "url", text: "Example body" }] },
        }),
    ].join("\n");
    const fakeFetch = async () => new Response(mockLines, { status: 200 });
    const tool = createExaWebSearchTool(fakeFetch as any);
    const registry = createToolRegistry([tool]);
    const result = await registry.execute("websearch_exa", { query: "test" }, {});
    expect(result.output).toContain("Example body");
  });
});

describe("batch tool", () => {
  it("executes multiple tools", async () => {
    const echoTool = {
      name: "echo",
      description: "echo",
      parameters: { parse: (v: any) => v, safeParse: (v: any) => ({ success: true, data: v }) } as any,
      execute: async (args: any) => ({ output: String(args.value) }),
    };
    const registry = createToolRegistry([echoTool]);
    const batch = createBatchTool(registry);
    const registryWithBatch = createToolRegistry([echoTool, batch]);
    const result = await registryWithBatch.execute(
      "batch",
      { tool_calls: [{ tool: "echo", parameters: { value: "hi" } }] },
      {}
    );
    expect(result.output).toContain("successful");
  });
});
