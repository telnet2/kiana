import { parsePatch, applyPatch } from "diff";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { z } from "zod";
import type { Tool, ToolContext } from "../../types";

type ParsedFile = {
  readonly patch: ReturnType<typeof parsePatch>[number];
  readonly oldPath?: string;
  readonly newPath?: string;
};

const resolvePath = (filePath: string, workingDir?: string) =>
  path.isAbsolute(filePath) ? filePath : path.join(workingDir ?? process.cwd(), filePath);

const ensureParent = async (target: string) => {
  const dir = path.dirname(target);
  await mkdir(dir, { recursive: true });
};

const filePathsFromPatch = (p: ReturnType<typeof parsePatch>[number]): ParsedFile => {
  const oldPath = p.oldFileName && p.oldFileName !== "/dev/null" ? p.oldFileName.replace(/^a\//, "") : undefined;
  const newPath = p.newFileName && p.newFileName !== "/dev/null" ? p.newFileName.replace(/^b\//, "") : undefined;
  const base = { patch: p } as ParsedFile;
  if (oldPath !== undefined) {
    Object.assign(base, { oldPath });
  }
  if (newPath !== undefined) {
    Object.assign(base, { newPath });
  }
  return base;
};

export const patchTool: Tool = {
  name: "patch",
  description: "do not use",
  parameters: z.object({
    patchText: z.string().describe("Unified diff patch text"),
  }),
  execute: async (args, context?: ToolContext) => {
    const parsed = parsePatch(args.patchText);
    if (parsed.length === 0) {
      throw new Error("No patch data found");
    }

    const changed: string[] = [];

    for (const entry of parsed.map(filePathsFromPatch)) {
      const targetPath = entry.newPath ?? entry.oldPath;
      if (!targetPath) {
        continue;
      }
      const resolved = resolvePath(targetPath, context?.workingDir);
      const file = Bun.file(resolved);
      const exists = await file.exists();
      const original = exists ? await file.text() : "";
      const next = applyPatch(original, entry.patch);
      if (next === false) {
        throw new Error(`Failed to apply patch for ${targetPath}`);
      }
      if (entry.patch.newFileName === "/dev/null") {
        await rm(resolved, { force: true }).catch(() => {});
        changed.push(resolved);
        continue;
      }
      await ensureParent(resolved);
      await Bun.write(resolved, next);
      if (entry.oldPath && entry.newPath && entry.oldPath !== entry.newPath) {
        const oldResolved = resolvePath(entry.oldPath, context?.workingDir);
        if (oldResolved !== resolved) {
          await rm(oldResolved, { force: true }).catch(() => {});
        }
      }
      changed.push(resolved);
    }

    const summary = `${changed.length} files changed`;
    return {
      title: summary,
      metadata: { files: changed },
      output: [summary, ...changed.map((p) => `- ${p}`)].join("\n"),
    };
  },
};
