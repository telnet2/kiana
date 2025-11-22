import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";

export type ToolRegistry = {
  register: (tool: Tool) => void;
  list: () => ReadonlyArray<Tool>;
  get: (name: string) => Tool | undefined;
  execute: (name: string, args: unknown, context: ToolContext) => Promise<ToolResult>;
};

const parseArgs = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  args: unknown
): z.infer<Schema> => {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
};

const ensurePermission = async <Schema extends z.ZodTypeAny>(
  tool: Tool<Schema>,
  args: z.infer<Schema>,
  context: ToolContext
) => {
  const permission = tool.permission;
  if (!permission) {
    return;
  }
  const allowed = await permission(args, context);
  if (!allowed) {
    throw new Error(`Tool not permitted: ${tool.name}`);
  }
};

export const createToolRegistry = (tools: ReadonlyArray<Tool> = []): ToolRegistry => {
  const map = new Map<string, Tool>();
  for (const tool of tools) {
    map.set(tool.name, tool);
  }

  const register = (tool: Tool) => {
    if (map.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    map.set(tool.name, tool);
  };

  const list = () => Array.from(map.values());

  const get = (name: string) => map.get(name);

  const execute = async (name: string, args: unknown, context: ToolContext) => {
    const tool = map.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const parsed = parseArgs(tool.parameters, args);
    await ensurePermission(tool, parsed, context);
    return tool.execute(parsed, context);
  };

  return { register, list, get, execute };
};
