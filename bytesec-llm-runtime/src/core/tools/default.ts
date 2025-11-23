import type { Tool } from "../../types";
import { builtinTools } from "./builtin";
import { createTodoTools, todoToolsFromStore } from "./todo";
import { createFileTodoStore } from "./todoStore";
import { multiEditTool } from "./multiedit";
import { patchTool } from "./patch";
import { createWebSearchTool } from "./websearch";
import { createExaWebSearchTool } from "./websearch-exa";
import { createBatchTool } from "./batch";
import { createToolRegistry } from "../tools";
import { createOpencodeTools } from "./opencode";

type DefaultToolOptions = {
  readonly includeExa?: boolean;
};

export const createDefaultTools = (options?: DefaultToolOptions): ReadonlyArray<Tool> => {
  const store = createFileTodoStore();
  const todos = createTodoTools(store);
  const list: Tool[] = [
    builtinTools.readFileTool,
    builtinTools.bashTool,
    builtinTools.fetchTool,
    todos.todoRead,
    todos.todoWrite,
    multiEditTool,
    patchTool,
    createWebSearchTool(),
  ];
  for (const tool of createOpencodeTools()) {
    if (list.some((t) => t.name === tool.name)) continue;
    list.push(tool);
  }
  if (options?.includeExa) {
    list.push(createExaWebSearchTool());
  }
  return list;
};

export const createDefaultToolRegistry = (options?: DefaultToolOptions) => {
  const tools = createDefaultTools(options);
  const registry = createToolRegistry(tools);
  registry.register(createBatchTool(registry));
  return registry;
};
