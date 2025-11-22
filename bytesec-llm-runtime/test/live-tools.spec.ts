import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultToolRegistry } from "../src";

const timeout = 30000;

describe("live tool flow", () => {
  it("runs end-to-end flow with todos, edits, patch, search, batch, summary", async () => {
      const dir = await mkdtemp(join(tmpdir(), "mycode-live-"));
      const registry = createDefaultToolRegistry({ includeExa: Boolean(Bun.env.EXA_API_KEY) });
      const ctx = { workingDir: dir, sessionId: "session-live" };

      // Write todos
      await registry.execute(
        "todowrite",
        {
          todos: [
            { id: "1", content: "Create Go notes file", status: "in_progress", priority: "high" },
            { id: "2", content: "Summarize findings", status: "pending", priority: "medium" },
          ],
        },
        ctx
      );
      const todos = await registry.execute("todoread", {}, ctx);
      expect(todos.metadata?.todos?.length).toBe(2);

      // Create file via patch
      const patch = [
        "--- /dev/null",
        "+++ b/go-notes.md",
        "@@ -0,0 +1,4 @@",
        "+# Go Notes",
        "+- Goroutine basics",
        "+- Channels overview",
        "+- Resources pending",
      ].join("\n");
      await registry.execute("patch", { patchText: patch }, ctx);

      // Refine content via multiedit
      await registry.execute(
        "multiedit",
        {
          filePath: join(dir, "go-notes.md"),
          edits: [
            {
              filePath: join(dir, "go-notes.md"),
              oldString: "Resources pending",
              newString: "Resources pending: add links",
            },
          ],
        },
        ctx
      );

      // Web search about Go
      const search = await registry.execute("websearch", { query: "golang concurrency" }, ctx);
      expect(search.output.length).toBeGreaterThan(0);

      // Batch run: read todo and echo status
      const batch = await registry.execute(
        "batch",
        {
          tool_calls: [
            { tool: "todoread", parameters: {} },
            { tool: "bash", parameters: { cmd: "echo", args: ["ok"] } },
          ],
        },
        ctx
      );
      expect(batch.metadata?.successful).toBeGreaterThan(0);

      // Summarize into file
      const summary = [
        "Summary:",
        "- Created go-notes.md",
        "- Updated todos",
        "- Performed websearch",
      ].join("\n");
      await registry.execute("bash", { cmd: "sh", args: ["-c", `printf '%s' "${summary}" > ${join(dir, "SUMMARY.txt")}`] }, ctx);
      const summaryText = await Bun.file(join(dir, "SUMMARY.txt")).text();
      expect(summaryText.includes("Summary")).toBe(true);

      await rm(dir, { recursive: true, force: true });
    }, { timeout });
});
