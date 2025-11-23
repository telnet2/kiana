import type { ConversationStore, ModelConfig, ToolContext, Tool } from "../types";
import type { StreamEvent } from "../types/events";
import type { ModelRegistry } from "./model";
import type { ToolRegistry } from "./tools";
import { createStreamEmitter } from "./streaming";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export type AgentModelConfig = {
  readonly provider: string;
  readonly config: ModelConfig;
};

export type AgentConfig = {
  readonly model: AgentModelConfig;
  readonly models: ModelRegistry;
  readonly tools?: ToolRegistry;
  readonly store?: ConversationStore;
};

export type AgentResponse = {
  readonly text: string;
};

export type Agent = {
  respond: (input: string, context?: ToolContext) => Promise<AgentResponse>;
  stream: (input: string, context?: ToolContext) => AsyncIterable<unknown>;
};

export const createAgent = (config: AgentConfig): Agent => {
  type AiTool = {
    readonly description: string;
    readonly inputSchema: unknown;
    readonly execute: (args: unknown) => Promise<unknown>;
    readonly type?: "function";
  };

  const toolsForAi = (tools?: ToolRegistry, context?: ToolContext) => {
    if (!tools) {
      return undefined;
    }
    const map: Record<string, AiTool> = {};
    for (const tool of tools.list()) {
      map[tool.name] = {
        description: tool.description,
        inputSchema: tool.parameters,
        execute: async (args: unknown) => tools.execute(tool.name, args, context ?? {}),
        type: "function",
      };
    }
    return map;
  };

  const mapAiStreamPart = (part: unknown): StreamEvent | undefined => {
    const typed = part as { type?: string; text?: string };
    if (typed.type === "text-delta") {
      return { type: "text", data: typed.text ?? "" };
    }
    if (typed.type === "tool-call") {
      const call = part as { toolCallId?: string; toolName?: string; input?: unknown };
      return {
        type: "tool_call",
        data: {
          id: call.toolCallId ?? call.toolName ?? "tool-call",
          tool: call.toolName ?? "unknown",
          args: call.input,
        },
      };
    }
    if (typed.type === "tool-result") {
      const result = part as { toolCallId?: string; toolName?: string; output?: unknown };
      const output = result.output;
      const metadata =
        typeof output === "object" && output !== null && "metadata" in output
          ? (output as { metadata?: Readonly<Record<string, unknown>> }).metadata
          : undefined;
      const event: StreamEvent = {
        type: "tool_result",
        data: {
          id: result.toolCallId ?? result.toolName ?? "tool-result",
          tool: result.toolName ?? "unknown",
          output,
        },
      };
      return metadata ? { ...event, metadata } : event;
    }
    if (typed.type === "tool-error" || typed.type === "error") {
      const error = part as { error?: unknown };
      return { type: "error", data: error.error ?? part };
    }
    if (typed.type === "finish") {
      const finish = part as { finishReason?: unknown; totalUsage?: unknown };
      return { type: "done", data: null, metadata: { finishReason: finish.finishReason, usage: finish.totalUsage } };
    }
    return undefined;
  };

  const streamWithAi = async function* (input: string, context?: ToolContext) {
    const baseUrl = config.model.provider === "modelsdev" ? "https://api.models.dev" : undefined;
    const settings: { apiKey?: string; baseURL?: string; headers?: Readonly<Record<string, string>> } = {};
    if (config.model.config.apiKey) {
      settings.apiKey = config.model.config.apiKey;
    }
    if (config.model.config.baseUrl) {
      settings.baseURL = config.model.config.baseUrl;
    }
    if (!config.model.config.baseUrl && baseUrl) {
      settings.baseURL = baseUrl;
    }
    if (config.model.config.headers) {
      settings.headers = config.model.config.headers;
    }

    const provider = createOpenAI(settings);
    const toolsMap = toolsForAi(config.tools, context) as never;
    const response = await streamText({
      model: provider(config.model.config.model),
      prompt: input,
      tools: toolsMap,
    });

    for await (const part of response.fullStream) {
      const mapped = mapAiStreamPart(part);
      if (mapped) {
        yield mapped;
      }
    }
  };

  const respond = async (input: string) => {
    const connection = await config.models.connect(config.model.provider, config.model.config);
    const text = await connection.generate(input);
    return { text };
  };

  const stream = async function* (input: string, context?: ToolContext) {
    if (config.tools && (config.model.provider === "openai" || config.model.provider === "modelsdev")) {
      for await (const event of streamWithAi(input, context)) {
        yield event;
      }
      return;
    }
    const emitter = createStreamEmitter();
    const connection = await config.models.connect(config.model.provider, config.model.config);
    for await (const event of connection.stream(input)) {
      emitter.emit(event.type, event);
      yield event;
    }
  };

  return { respond, stream };
};
