import type { ConversationStore, ModelConfig, ToolContext, Tool } from "../types";
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
  const toolsForAi = (tools?: ToolRegistry, context?: ToolContext) => {
    if (!tools) {
      return undefined;
    }
    const map: Record<string, Tool> = {};
    for (const tool of tools.list()) {
      map[tool.name] = {
        ...tool,
        execute: async (args: unknown) => tools.execute(tool.name, args, context ?? {}),
      };
    }
    return map;
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

    for await (const delta of response.textStream) {
      yield { type: "text", data: delta } as const;
    }
    yield { type: "done", data: null } as const;
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
