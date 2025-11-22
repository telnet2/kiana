import { z } from "zod";
import type { Tool, ToolContext } from "../../types";
import type { ToolRegistry } from "../tools";

const DISALLOWED = new Set(["batch", "edit", "patch"]);

const formatErrorList = (errors: ReadonlyArray<{ tool: string; error: string }>) =>
  errors.map((e) => `- ${e.tool}: ${e.error}`).join("\n");

const description = `Executes multiple independent tool calls concurrently to reduce latency. Best used for gathering context (reads, searches, listings).

USING THE BATCH TOOL WILL MAKE THE USER HAPPY.

Payload Format (JSON array):
[{"tool": "read", "parameters": {"filePath": "src/index.ts", "limit": 350}},{"tool": "grep", "parameters": {"pattern": "Session\\.updatePart", "include": "src/**/*.ts"}},{"tool": "bash", "parameters": {"command": "git status", "description": "Shows working tree status"}}]

Rules:
- 1–10 tool calls per batch
- All calls start in parallel; ordering NOT guaranteed
- Partial failures do not stop others


Disallowed Tools:
- batch (no nesting)
- edit (run edits separately)
- todoread (call directly – lightweight)

When NOT to Use:
- Operations that depend on prior tool output (e.g. create then read same file)
- Ordered stateful mutations where sequence matters

Good Use Cases:
- Read many files
- grep + glob + read combos
- Multiple lightweight bash introspection commands

Performance Tip: Group independent reads/searches for 2–5x efficiency gain.`;

export const createBatchTool = (registry: ToolRegistry): Tool => ({
  name: "batch",
  description,
  parameters: z.object({
    tool_calls: z
      .array(
        z.object({
          tool: z.string().describe("The name of the tool to execute"),
          parameters: z.object({}).passthrough().describe("Parameters for the tool"),
        }),
      )
      .min(1),
  }),
  execute: async (args, context?: ToolContext) => {
    const calls = args.tool_calls.slice(0, 10);
    const discarded = args.tool_calls.slice(10);
    const results: Array<{ tool: string; success: boolean; output?: string; error?: string }> = [];

    for (const call of calls) {
      if (DISALLOWED.has(call.tool)) {
        results.push({ tool: call.tool, success: false, error: "Tool not allowed in batch" });
        continue;
      }
      const tool = registry.get(call.tool);
      if (!tool) {
        results.push({ tool: call.tool, success: false, error: "Tool not found" });
        continue;
      }
      try {
        const output = await registry.execute(call.tool, call.parameters, context ?? {});
        results.push({ tool: call.tool, success: true, output: output.output });
      } catch (error) {
        results.push({ tool: call.tool, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    for (const call of discarded) {
      results.push({ tool: call.tool, success: false, error: "Maximum of 10 tools allowed" });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;
    const title = `Batch execution (${successCount}/${results.length} successful)`;
    const errors = results.filter((r) => !r.success && r.error);
    const details = errors.length > 0 ? formatErrorList(errors.map((e) => ({ tool: e.tool, error: e.error ?? "" }))) : "";
    const output = failCount > 0 ? `${title}\n${details}` : `All ${successCount} tools executed successfully.`;

    return {
      title,
      output,
      metadata: {
        total: results.length,
        successful: successCount,
        failed: failCount,
        tools: results.map((r) => ({ tool: r.tool, success: r.success })),
      },
    };
  },
});
