import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import type { GenerateOptions, ModelConfig, ModelConnection, ModelProvider, StreamEvent } from "../../types";

const buildRequestOptions = (options?: GenerateOptions) => {
  const request: Partial<{ temperature: number; maxTokens: number; stopSequences: string[] }> = {};
  if (options?.temperature !== undefined) {
    request.temperature = options.temperature;
  }
  if (options?.maxTokens !== undefined) {
    request.maxTokens = options.maxTokens;
  }
  if (options?.stop && options.stop.length > 0) {
    request.stopSequences = [...options.stop];
  }
  return request;
};

const toTextEvent = (data: string): StreamEvent => ({ type: "text", data });

const doneEvent: StreamEvent = { type: "done", data: null };

const createAiConnection = (config: ModelConfig, baseUrl?: string): ModelConnection => {
  const settings: { apiKey?: string; baseURL?: string; headers?: Readonly<Record<string, string>> } = {};
  if (config.apiKey) {
    settings.apiKey = config.apiKey;
  }
  if (config.baseUrl) {
    settings.baseURL = config.baseUrl;
  }
  if (!config.baseUrl && baseUrl) {
    settings.baseURL = baseUrl;
  }
  if (config.headers) {
    settings.headers = config.headers;
  }

  const provider = createOpenAI(settings);

  const generate = async (prompt: string, options?: GenerateOptions) => {
    const result = await generateText({
      model: provider(config.model),
      prompt,
      ...buildRequestOptions(options),
    });
    return result.text;
  };

  const stream = async function* (prompt: string, options?: GenerateOptions) {
    const result = await streamText({
      model: provider(config.model),
      prompt,
      ...buildRequestOptions(options),
    });

    for await (const delta of result.textStream) {
      yield toTextEvent(delta);
    }

    yield doneEvent;
  };

  return { generate, stream };
};

export const openAIProvider: ModelProvider = {
  id: "openai",
  name: "OpenAI",
  connect: async (config) => createAiConnection(config),
};

export const modelsDevProvider: ModelProvider = {
  id: "modelsdev",
  name: "Models.dev",
  connect: async (config) => createAiConnection(config, "https://api.models.dev"),
};
