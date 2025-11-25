import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { StreamEvent } from "./types";
import { createAgent } from "./core/agent";
import { createModelRegistry } from "./core/model";
import { modelsDevProvider, openAIProvider } from "./core/providers/openai";
import { createDefaultToolRegistry } from "./core/tools/default";
import { createFileTodoStore } from "./core/tools/todoStore";
import type { Todo } from "./core/tools/todo";
import type { ToolCallEvent, ToolResultEvent } from "./types/events";
import type { ToolContext } from "./types";
import { loadConfig } from "./utils/config";

type ToolCallEntry = {
  readonly id: string;
  readonly tool: string;
  readonly args: unknown;
};

type ToolResultEntry = {
  readonly id: string;
  readonly tool: string;
  readonly output: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

type TuiState = {
  instruction: string;
  assistantText: string;
  toolCalls: ToolCallEntry[];
  toolResults: ToolResultEntry[];
  todos: Todo[];
  status: "idle" | "running";
  error?: string;
};

const truncate = (text: string, limit = 200) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
};

const safeStringify = (value: unknown, limit = 200) => {
  try {
    return truncate(typeof value === "string" ? value : JSON.stringify(value, null, 2), limit);
  } catch {
    return "[unserializable]";
  }
};

const formatError = (error: unknown) => {
  if (error && typeof error === "object") {
    const err = error as {
      message?: string;
      name?: string;
      status?: number;
      response?: { status?: number; statusText?: string };
      responseBody?: { error?: { message?: string; code?: string; type?: string } };
      cause?: unknown;
    };
    const body = err.responseBody ?? (err.cause as { responseBody?: unknown } | undefined)?.responseBody;
    const apiError = (body as { error?: { message?: string; code?: string; type?: string } } | undefined)?.error;
    const payload = {
      name: err.name,
      message: err.message,
      status: err.status ?? err.response?.status,
      detail: apiError?.message,
      code: apiError?.code ?? apiError?.type,
      body,
    };
    return safeStringify(payload, 400);
  }
  return safeStringify(error, 400);
};

const statusMark = (status: Todo["status"]) => {
  if (status === "completed") return "[x]";
  if (status === "in_progress") return "[~]";
  if (status === "cancelled") return "[!]";
  return "[ ]";
};

const renderTodoTree = (todos: ReadonlyArray<Todo>): string[] => {
  const lines = ["- Todos / Tasks"];
  if (todos.length === 0) {
    lines.push("  - [ ] No todos yet");
    return lines;
  }
  const sections: Array<{ label: string; status: Todo["status"] }> = [
    { label: "In Progress", status: "in_progress" },
    { label: "Pending", status: "pending" },
    { label: "Completed", status: "completed" },
    { label: "Cancelled", status: "cancelled" },
  ];
  for (const section of sections) {
    const entries = todos.filter((todo) => todo.status === section.status);
    if (entries.length === 0) continue;
    lines.push(`  - ${section.label}`);
    for (const todo of entries) {
      lines.push(`    - ${statusMark(todo.status)} ${todo.content} (#${todo.id}, ${todo.priority})`);
    }
  }
  return lines;
};

const renderState = (state: TuiState, context: { model: string; provider: string; sessionId: string }) => {
  console.clear();
  console.log("LLM Runtime TUI");
  console.log(`Session: ${context.sessionId} | Model: ${context.provider}/${context.model}`);
  console.log("");
  console.log(`Instruction: ${state.instruction || "(none)"}`);
  console.log("");
  console.log("Assistant Response:");
  console.log(state.assistantText || "(waiting for response)");
  console.log("");
  console.log("Tool Calls:");
  if (state.toolCalls.length === 0) {
    console.log("- (none)");
  } else {
    for (const call of state.toolCalls) {
      console.log(`- ${call.tool} (${call.id}): ${safeStringify(call.args)}`);
    }
  }
  console.log("");
  console.log("Tool Results:");
  if (state.toolResults.length === 0) {
    console.log("- (none)");
  } else {
    for (const result of state.toolResults) {
      console.log(`- ${result.tool} (${result.id}): ${safeStringify(result.output)}`);
      if (result.metadata) {
        console.log(`  metadata: ${safeStringify(result.metadata)}`);
      }
    }
  }
  console.log("");
  for (const line of renderTodoTree(state.todos)) {
    console.log(line);
  }
  if (state.error) {
    console.log("");
    console.log(`Error: ${state.error}`);
  }
  console.log("");
  console.log(state.status === "running" ? "Status: running..." : "Status: idle");
  console.log("");
  if (state.status === "idle") {
    console.log("Enter a new instruction to continue or press Enter on empty input to exit.");
  }
};

const updateTodosFromMetadata = (current: Todo[], metadata?: Readonly<Record<string, unknown>>) => {
  const todos = metadata?.todos;
  if (!Array.isArray(todos)) {
    return current;
  }
  return todos as Todo[];
};

const defaultModelConfig = () => {
  const provider = Bun.env.LLM_PROVIDER ?? "openai";
  const model = Bun.env.LLM_MODEL ?? "gpt-4o-mini";
  return { provider, model };
};

const readStream = async (
  agent: ReturnType<typeof createAgent>,
  instruction: string,
  toolContext: ToolContext,
  state: TuiState,
  context: { provider: string; model: string; sessionId: string }
) => {
  state.instruction = instruction;
  state.assistantText = "";
  state.toolCalls = [];
  state.toolResults = [];
  if ("error" in state) {
    delete state.error;
  }
  state.status = "running";
  renderState(state, context);

  try {
    for await (const event of agent.stream(instruction, toolContext)) {
      const typed = event as StreamEvent;
      if (typed.type === "text") {
        state.assistantText += String(typed.data ?? "");
      } else if (typed.type === "tool_call") {
        const call = typed.data as ToolCallEvent;
        state.toolCalls = [...state.toolCalls, { id: call.id, tool: call.tool, args: call.args }];
      } else if (typed.type === "tool_result") {
        const result = typed.data as ToolResultEvent;
        const entryBase: ToolResultEntry = {
          id: result.id,
          tool: result.tool,
          output: (result as { output?: unknown }).output ?? result,
        };
        const entry = typed.metadata ? { ...entryBase, metadata: typed.metadata } : entryBase;
        state.toolResults = [...state.toolResults, entry];
        state.todos = updateTodosFromMetadata(state.todos, typed.metadata ?? result.metadata);
      } else if (typed.type === "error") {
        state.error = formatError(typed.data ?? "Unknown error");
      } else if (typed.type === "done") {
        state.status = "idle";
      }
      renderState(state, context);
    }
  } catch (error) {
    state.error = formatError(error);
    state.status = "idle";
    renderState(state, context);
  }
  state.status = "idle";
  renderState(state, context);
};

export const runRuntimeTui = async () => {
  const { provider, model } = defaultModelConfig();
  const config = loadConfig();
  const needsKey = provider === "openai" || provider === "modelsdev";
  if (needsKey && !config.openaiKey && !config.baseUrl) {
    console.error(
      "Missing API key for provider 'openai'. Set OPENAI_API_KEY (or OPENAI_APIKEY) or provide a custom base URL via MYCODE_BASE_URL."
    );
    return;
  }
  if (!needsKey && !config.anthropicKey && !config.baseUrl) {
    console.error("Missing API key. Set ANTHROPIC_API_KEY or provide a custom base URL via MYCODE_BASE_URL.");
    return;
  }

  const models = createModelRegistry([openAIProvider, modelsDevProvider]);
  const tools = createDefaultToolRegistry({ includeExa: Boolean(Bun.env.EXA_API_KEY) });
  const agent = createAgent({
    model: {
      provider,
      config: {
        model,
        ...(provider === "openai" || provider === "modelsdev"
          ? config.openaiKey
            ? { apiKey: config.openaiKey }
            : {}
          : config.anthropicKey
            ? { apiKey: config.anthropicKey }
            : {}),
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      },
    },
    models,
    tools,
  });

  const sessionId = Bun.env.MYCODE_SESSION_ID ?? "runtime-tui";
  const workingDir = Bun.env.MYCODE_WORKDIR ?? process.cwd();
  const todoStore = createFileTodoStore();
  const initialTodos = await todoStore.load(sessionId);
  const state: TuiState = {
    instruction: "",
    assistantText: "",
    toolCalls: [],
    toolResults: [],
    todos: [...initialTodos],
    status: "idle",
  };

  const rl = createInterface({ input, output, terminal: true });
  const toolContext: ToolContext = { workingDir, sessionId };
  let keepRunning = true;

  while (keepRunning) {
    renderState(state, { provider, model, sessionId });
    const instruction = (await rl.question("Instruction: ")).trim();
    if (!instruction) {
      keepRunning = false;
      break;
    }
    await readStream(agent, instruction, toolContext, state, { provider, model, sessionId });
  }
  rl.close();
};

if (import.meta.main) {
  runRuntimeTui().catch((error) => {
    console.error("Failed to start TUI:", error);
    process.exit(1);
  });
}
