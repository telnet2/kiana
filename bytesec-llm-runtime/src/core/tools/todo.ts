import { z } from "zod";
import type { Tool, ToolContext } from "../../types";

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TodoPriority = "high" | "medium" | "low";

export type Todo = {
  readonly id: string;
  readonly content: string;
  readonly status: TodoStatus;
  readonly priority: TodoPriority;
};

export type TodoStore = {
  load: (sessionId: string) => Promise<ReadonlyArray<Todo>>;
  save: (sessionId: string, todos: ReadonlyArray<Todo>) => Promise<void>;
};

const TodoSchema = z.object({
  id: z.string().describe("Unique identifier for the todo item"),
  content: z.string().describe("Brief description of the task"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status"),
  priority: z.enum(["high", "medium", "low"]).describe("Priority level"),
});

export const createTodoTools = (store: TodoStore) => {
  const todoRead: Tool = {
    name: "todoread",
    description:
      "Use this tool to read the current to-do list for the session. This tool should be used proactively and frequently to ensure that you are aware of\n" +
      "the status of the current task list. You should make use of this tool as often as possible, especially in the following situations:\n" +
      "- At the beginning of conversations to see what's pending\n" +
      "- Before starting new tasks to prioritize work\n" +
      "- When the user asks about previous tasks or plans\n" +
      "- Whenever you're uncertain about what to do next\n" +
      "- After completing tasks to update your understanding of remaining work\n" +
      "- After every few messages to ensure you're on track\n" +
      "\nUsage:\n" +
      "- This tool takes in no parameters. So leave the input blank or empty. DO NOT include a dummy object, placeholder string or a key like \"input\" or \"empty\". LEAVE IT BLANK.\n" +
      "- Returns a list of todo items with their status, priority, and content\n" +
      "- Use this information to track progress and plan next steps\n" +
      "- If no todos exist yet, an empty list will be returned",
    parameters: z.object({}),
    execute: async (_args, context) => {
      const sessionId = context.sessionId ?? "default";
      const todos = await store.load(sessionId);
      const active = todos.filter((x: Todo) => x.status !== "completed").length;
      return {
        title: `${active} todos`,
        metadata: { todos },
        output: JSON.stringify(todos, null, 2),
      };
    },
  };

  const todoWrite: Tool = {
    name: "todowrite",
    description:
      "Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.\n" +
      "It also helps the user understand the progress of the task and overall progress of their requests.\n\n" +
      "When to Use This Tool\n" +
      "1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions\n" +
      "2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations\n" +
      "3. User explicitly requests todo list - When the user directly asks you to use the todo list\n" +
      "4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)\n" +
      "5. After receiving new instructions - Immediately capture user requirements as todos. Feel free to edit the todo list based on new information.\n" +
      "6. After completing a task - Mark it complete and add any new follow-up tasks\n" +
      "7. When you start working on a new task, mark the todo as in_progress. Ideally you should only have one todo as in_progress at a time. Complete existing tasks before starting new ones.\n\n" +
      "When NOT to Use This Tool\n" +
      "1. There is only a single, straightforward task\n" +
      "2. The task is trivial and tracking it provides no organizational benefit\n" +
      "3. The task can be completed in less than 3 trivial steps\n" +
      "4. The task is purely conversational or informational\n\n" +
      "Task States and Management\n" +
      "- pending: not started\n" +
      "- in_progress: currently working (limit to one at a time)\n" +
      "- completed: finished\n" +
      "- cancelled: no longer needed",
    parameters: z.object({
      todos: z.array(TodoSchema).describe("The updated todo list"),
    }),
    execute: async (args, context) => {
      const sessionId = context.sessionId ?? "default";
      await store.save(sessionId, args.todos);
      const active = args.todos.filter((x: Todo) => x.status !== "completed").length;
      return {
        title: `${active} todos`,
        metadata: { todos: args.todos },
        output: JSON.stringify(args.todos, null, 2),
      };
    },
  };

  return { todoRead, todoWrite } as const;
};

export const todoToolsFromStore = (store: TodoStore) => Object.values(createTodoTools(store));

export const todoToolsWithContext = (store: TodoStore, context: ToolContext) =>
  todoToolsFromStore({
    load: (sessionId) => store.load(context.sessionId ?? sessionId),
    save: (sessionId, todos) => store.save(context.sessionId ?? sessionId, todos),
  });
