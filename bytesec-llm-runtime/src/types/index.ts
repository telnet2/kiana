import type { z } from "zod";
import type { StreamEvent } from "./events";

export type ModelConfig = {
  readonly model: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly options?: Readonly<Record<string, unknown>>;
};

export type GenerateOptions = {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stop?: ReadonlyArray<string>;
};

export type StreamOptions = GenerateOptions & {
  readonly maxStreamTokens?: number;
};

export type ModelConnection = {
  generate: (prompt: string, options?: GenerateOptions) => Promise<string>;
  stream: (prompt: string, options?: StreamOptions) => AsyncIterable<StreamEvent>;
};

export type ModelProvider = {
  readonly id: string;
  readonly name: string;
  connect: (config: ModelConfig) => Promise<ModelConnection>;
};

export type ToolContext = {
  readonly signal?: AbortSignal;
  readonly workingDir?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly sessionId?: string;
};

export type ToolAttachment = {
  readonly name: string;
  readonly contentType: string;
  readonly data: string | Uint8Array;
};

export type ToolResult = {
  readonly output: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly attachments?: ReadonlyArray<ToolAttachment>;
};

export type ToolPermission<Schema extends z.ZodTypeAny = z.ZodTypeAny> = (
  args: z.infer<Schema>,
  context: ToolContext
) => Promise<boolean> | boolean;

export type Tool<Schema extends z.ZodTypeAny = z.ZodTypeAny> = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Schema;
  readonly execute: (args: z.infer<Schema>, context: ToolContext) => Promise<ToolResult>;
  readonly permission?: ToolPermission<Schema>;
};

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type Message = {
  readonly role: MessageRole;
  readonly content: string;
  readonly toolCallId?: string;
};

export type Conversation = {
  readonly id: string;
  readonly messages: ReadonlyArray<Message>;
};

export type ConversationStore = {
  load: (id: string) => Promise<Conversation | undefined>;
  save: (conversation: Conversation) => Promise<void>;
};

export type {
  StreamEvent,
} from "./events";
