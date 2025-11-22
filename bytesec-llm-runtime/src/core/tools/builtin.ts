import { z } from "zod";
import { fetch } from "undici";
import TurndownService from "turndown";
import type { Tool } from "../../types";

const textFromHtml = (html: string) => html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const markdownFromHtml = (() => {
  const service = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
  service.addRule("pre", {
    filter: "pre",
    replacement: (content: string) => `

${content}

`,
  });
  return (html: string) => service.turndown(html).replace(/^- +/gm, "- ").trim();
})();

const readFileTool: Tool = {
  name: "read_file",
  description: "Read a file from disk using Bun.file",
  parameters: z.object({ path: z.string(), encoding: z.enum(["utf8", "base64"]).optional() }),
  execute: async (args) => {
    const file = Bun.file(args.path);
    const encoding = args.encoding ?? "utf8";
    const buffer = await file.arrayBuffer();
    if (encoding === "base64") {
      const output = Buffer.from(buffer).toString("base64");
      return { output };
    }
    const output = new TextDecoder().decode(buffer);
    return { output };
  },
};

const bashTool: Tool = {
  name: "bash",
  description: "Execute a command using Bun.spawn",
  parameters: z.object({ cmd: z.string(), args: z.array(z.string()).optional() }),
  execute: async (args, context) => {
    const proc = Bun.spawn([
      args.cmd,
      ...(args.args ?? []),
    ], {
      ...(context?.workingDir ? { cwd: context.workingDir } : {}),
      ...(context?.env ? { env: context.env } : {}),
    });
    const output = await new Response(proc.stdout).text();
    const errorOutput = await new Response(proc.stderr).text();
    const combined = errorOutput ? `${output}\n${errorOutput}` : output;
    return { output: combined.trim() };
  },
};

const fetchTool: Tool = {
  name: "fetch_web",
  description: "Fetch a URL and return text or markdown",
  parameters: z.object({ url: z.string().url(), format: z.enum(["markdown", "text"]).optional() }),
  execute: async (args) => {
    const response = await fetch(args.url);
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const wantsMarkdown = args.format === "markdown" || contentType.includes("markdown");
    if (contentType.includes("text/plain")) {
      return { output: body };
    }
    if (contentType.includes("text/markdown") || wantsMarkdown) {
      const md = contentType.includes("text/html") ? markdownFromHtml(body) : body;
      return { output: md };
    }
    const text = contentType.includes("text/html") ? textFromHtml(body) : body;
    return { output: text };
  },
};

export const builtinTools = {
  readFileTool,
  bashTool,
  fetchTool,
};
