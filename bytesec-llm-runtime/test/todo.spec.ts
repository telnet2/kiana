import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../src";
import { createTodoTools } from "../src/core/tools/todo";
import { createFileTodoStore } from "../src/core/tools/todoStore";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempStore = async () => {
  const dir = await mkdtemp(join(tmpdir(), "todo-store-"));
  const store = createFileTodoStore(dir);
  return { dir, store };
};

describe("todo tools", () => {
  it("reads empty list", async () => {
    const { dir, store } = await tempStore();
    try {
      const { todoRead } = createTodoTools(store);
      const registry = createToolRegistry([todoRead]);
      const result = await registry.execute("todoread", {}, { sessionId: "s1" });
      expect(result.metadata?.todos).toEqual([]);
      expect(result.output).toBe(JSON.stringify([], null, 2));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes and reads todos", async () => {
    const { dir, store } = await tempStore();
    try {
      const { todoRead, todoWrite } = createTodoTools(store);
      const registry = createToolRegistry([todoRead, todoWrite]);
      const todos = [
        { id: "1", content: "Do thing", status: "pending", priority: "high" },
        { id: "2", content: "Done thing", status: "completed", priority: "low" },
      ];
      const write = await registry.execute("todowrite", { todos }, { sessionId: "s1" });
      expect(write.title).toBe("1 todos");
      const read = await registry.execute("todoread", {}, { sessionId: "s1" });
      expect(read.title).toBe("1 todos");
      expect(read.metadata?.todos).toEqual(todos);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
