import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Tool, ToolContext } from "../../types";
import * as Diff from "diff";

const resolvePath = (filePath: string, context?: ToolContext) =>
  path.isAbsolute(filePath) ? filePath : path.join(context?.workingDir ?? process.cwd(), filePath);

const ensureDir = async (filePath: string) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
};

const readLines = (text: string, offset: number, limit: number) => {
  const lines = text.split("\n");
  const slice = lines.slice(offset, offset + limit);
  return slice.map((line, idx) => `${(offset + idx + 1).toString().padStart(5, "0")}| ${line}`).join("\n");
};

const readTool: Tool = {
  name: "read",
  description: "Read a file with optional offset/limit, returning numbered lines",
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.number().int().nonnegative().optional().describe("Line number to start from (0-based)"),
    limit: z.number().int().positive().optional().describe("Number of lines to read"),
  }),
  execute: async (args, context) => {
    const filePath = resolvePath(args.filePath, context);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${filePath}`);
    }
    const text = await file.text();
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 2000;
    const output = readLines(text, offset, limit);
    return {
      title: path.relative(context?.workingDir ?? process.cwd(), filePath),
      output,
      metadata: { preview: output.slice(0, 2000) },
    };
  },
};

const writeTool: Tool = {
  name: "write",
  description: "Write content to a file (creates directories as needed)",
  parameters: z.object({
    filePath: z.string().describe("Path to write (absolute or relative to working dir)"),
    content: z.string().describe("Content to write"),
  }),
  execute: async (args, context) => {
    const filePath = resolvePath(args.filePath, context);
    await ensureDir(filePath);
    await Bun.write(filePath, args.content);
    return {
      title: path.relative(context?.workingDir ?? process.cwd(), filePath),
      output: "wrote file",
    };
  },
};

const editTool: Tool = {
  name: "edit",
  description: "Replace text in a file. Provide oldString and newString; optionally replace all occurrences.",
  parameters: z.object({
    filePath: z.string(),
    oldString: z.string(),
    newString: z.string(),
    replaceAll: z.boolean().optional(),
  }),
  execute: async (args, context) => {
    const filePath = resolvePath(args.filePath, context);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${filePath}`);
    }
    const original = await file.text();
    const replaceOne = () => {
      const idx = original.indexOf(args.oldString);
      if (idx === -1) throw new Error("oldString not found in file");
      return original.slice(0, idx) + args.newString + original.slice(idx + args.oldString.length);
    };
    const next =
      args.oldString === ""
        ? args.newString
        : args.replaceAll
          ? original.split(args.oldString).join(args.newString)
          : replaceOne();
    await file.write(next);
    const patch = (Diff as any).createTwoFilesPatch
      ? (Diff as any).createTwoFilesPatch(filePath, filePath, original, next)
      : next;
    return { title: path.relative(context?.workingDir ?? process.cwd(), filePath), output: patch };
  },
};

const lsTool: Tool = {
  name: "ls",
  description: "List files and directories in a path",
  parameters: z.object({
    path: z.string().optional().describe("Directory to list (defaults to working dir)"),
  }),
  execute: async (args, context) => {
    const dir = args.path ? resolvePath(args.path, context) : context?.workingDir ?? process.cwd();
    const entries = await readdir(dir, { withFileTypes: true });
    const lines = entries.map((e) => `${e.isDirectory() ? "d" : "-"} ${e.name}`);
    return { title: dir, output: lines.join("\n"), metadata: { count: entries.length } };
  },
};

const globTool: Tool = {
  name: "glob",
  description: "Match files using a glob pattern",
  parameters: z.object({
    pattern: z.string(),
    path: z.string().optional().describe("Search root (defaults to working dir)"),
  }),
  execute: async (args, context) => {
    const cwd = args.path ? resolvePath(args.path, context) : context?.workingDir ?? process.cwd();
    const glob = new Bun.Glob(args.pattern);
    const matches: string[] = [];
    for await (const match of glob.scan({ cwd })) {
      matches.push(path.resolve(cwd, match));
      if (matches.length >= 100) break;
    }
    return {
      title: cwd,
      output: matches.length > 0 ? matches.join("\n") : "No files found",
      metadata: { count: matches.length },
    };
  },
};

const grepTool: Tool = {
  name: "grep",
  description: "Search for a pattern in files using ripgrep",
  parameters: z.object({
    pattern: z.string().describe("Regex or text to search for"),
    path: z.string().optional().describe("File or directory to search (defaults to working dir)"),
    glob: z.string().optional().describe("Glob to include"),
  }),
  execute: async (args, context) => {
    const cwd = context?.workingDir ?? process.cwd();
    const target = args.path ? resolvePath(args.path, context) : cwd;
    const cmd = ["rg", "--line-number", args.pattern, target];
    if (args.glob) {
      cmd.push("-g", args.glob);
    }
    const proc = Bun.spawn(cmd, { cwd });
    const output = await new Response(proc.stdout).text();
    const errorOutput = await new Response(proc.stderr).text();
    if (errorOutput && !proc.exitCode) {
      return { title: target, output: output.trim(), metadata: { stderr: errorOutput.trim() } };
    }
    if (proc.exitCode !== 0 && !output.trim()) {
      throw new Error(errorOutput || `ripgrep exited with code ${proc.exitCode}`);
    }
    return { title: target, output: output.trim(), metadata: { stderr: errorOutput.trim() || undefined } };
  },
};

const webfetchTool: Tool = {
  name: "webfetch",
  description: "Fetch a URL and return text or markdown",
  parameters: z.object({
    url: z.string().url(),
    format: z.enum(["markdown", "text"]).optional(),
  }),
  execute: async (args) => {
    const response = await fetch(args.url);
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const wantsMarkdown = args.format === "markdown" || contentType.includes("markdown");
    if (contentType.includes("text/plain")) {
      return { title: args.url, output: body };
    }
    if (contentType.includes("text/markdown") || wantsMarkdown) {
      return { title: args.url, output: body };
    }
    return { title: args.url, output: body };
  },
};

const codesearchTool: Tool = {
  name: "codesearch",
  description: "Lightweight code search stub (uses web search semantics)",
  parameters: z.object({
    query: z.string(),
    tokensNum: z.number().optional(),
  }),
  execute: async (args) => ({
    title: `Code search: ${args.query}`,
    output: "Code search is not yet implemented in this runtime. Please use websearch or grep/glob to gather context.",
  }),
};

const taskTool: Tool = {
  name: "task",
  description: "Launch a secondary task/subagent (not supported in this runtime)",
  parameters: z.object({
    description: z.string(),
    prompt: z.string(),
    subagent_type: z.string(),
    session_id: z.string().optional(),
  }),
  execute: async (args) => ({
    title: args.description,
    output: "Task tool is not available in this runtime.",
  }),
};

const lspHoverTool: Tool = {
  name: "lsp-hover",
  description: "LSP hover info (not supported in this runtime)",
  parameters: z.object({ filePath: z.string(), line: z.number(), column: z.number() }),
  execute: async () => ({ title: "lsp-hover", output: "LSP hover is not available in this runtime." }),
};

const lspDiagnosticsTool: Tool = {
  name: "lsp-diagnostics",
  description: "LSP diagnostics (not supported in this runtime)",
  parameters: z.object({}),
  execute: async () => ({ title: "lsp-diagnostics", output: "LSP diagnostics are not available in this runtime." }),
};

export const createOpencodeTools = (): ReadonlyArray<Tool> => [
  readTool,
  writeTool,
  editTool,
  lsTool,
  globTool,
  grepTool,
  webfetchTool,
  codesearchTool,
  taskTool,
  lspHoverTool,
  lspDiagnosticsTool,
];
