import { z } from "zod";
import path from "node:path";
import type { Tool, ToolContext } from "../../types";

type EditInput = {
  readonly filePath: string;
  readonly oldString: string;
  readonly newString: string;
  readonly replaceAll?: boolean;
};

const resolveFile = (filePath: string, workingDir?: string) =>
  path.isAbsolute(filePath) ? filePath : path.join(workingDir ?? process.cwd(), filePath);

const applyEdits = (content: string, edits: ReadonlyArray<EditInput>) => {
  let next = content;
  for (const edit of edits) {
    const replaceAll = edit.replaceAll ?? false;
    const target = edit.oldString;
    const replacement = edit.newString;
    if (replaceAll) {
      next = next.split(target).join(replacement);
      continue;
    }
    next = next.replace(target, replacement);
  }
  return next;
};

const description = `This is a tool for making multiple edits to a single file in one operation. It is built on top of the Edit tool and allows you to perform multiple find-and-replace operations efficiently. Prefer this tool over the Edit tool when you need to make multiple edits to the same file.

Before using this tool:

1. Use the Read tool to understand the file's contents and context
2. Verify the directory path is correct

To make multiple file edits, provide the following:
1. file_path: The absolute path to the file to modify (must be absolute, not relative)
2. edits: An array of edit operations to perform, where each edit contains:
   - oldString: The text to replace (must match the file contents exactly, including all whitespace and indentation)
   - newString: The edited text to replace the oldString
   - replaceAll: Replace all occurrences of oldString. This parameter is optional and defaults to false.

IMPORTANT:
- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit
- All edits must be valid for the operation to succeed - if any edit fails, none will be applied
- This tool is ideal when you need to make several changes to different parts of the same file

CRITICAL REQUIREMENTS:
1. All edits follow the same requirements as the single Edit tool
2. The edits are atomic - either all succeed or none are applied
3. Plan your edits carefully to avoid conflicts between sequential operations

WARNING:
- The tool will fail if edits.oldString doesn't match the file contents exactly (including whitespace)
- The tool will fail if edits.oldString and edits.newString are the same
- Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find

When making edits:
- Ensure all edits result in idiomatic, correct code
- Do not leave the code in a broken state
- Always use absolute file paths (starting with /)
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use replaceAll for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.

If you want to create a new file, use:
- A new file path, including dir name if needed
- First edit: empty oldString and the new file's contents as newString
- Subsequent edits: normal edit operations on the created content`;

export const multiEditTool: Tool = {
  name: "multiedit",
  description,
  parameters: z.object({
    filePath: z.string().describe("The absolute or relative path to the file to modify"),
    edits: z
      .array(
        z.object({
          filePath: z.string().describe("The absolute path to the file to modify"),
          oldString: z.string().describe("The text to replace"),
          newString: z.string().describe("The text to replace it with"),
          replaceAll: z.boolean().optional().describe("Replace all occurrences of oldString (default false)"),
        }),
      )
      .min(1),
  }),
  execute: async (args, context?: ToolContext) => {
    const targetPath = resolveFile(args.filePath, context?.workingDir);
    const file = Bun.file(targetPath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${targetPath}`);
    }
    const original = await file.text();
    const updated = applyEdits(original, args.edits);
    await Bun.write(targetPath, updated);
    const summary = `${args.edits.length} edits applied`;
    return {
      title: summary,
      metadata: { file: targetPath, edits: args.edits.map((edit: EditInput) => ({ old: edit.oldString, new: edit.newString })) },
      output: updated,
    };
  },
};
