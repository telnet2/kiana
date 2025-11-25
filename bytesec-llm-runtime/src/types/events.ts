export type StreamEventType = "text" | "tool_call" | "tool_result" | "error" | "done";

export type ToolCallEvent = {
  readonly id: string;
  readonly tool: string;
  readonly args: unknown;
};

export type ToolResultEvent = {
  readonly id: string;
  readonly tool: string;
  readonly output: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type StreamEvent = {
  readonly type: StreamEventType;
  readonly data: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type StreamObserver = (event: StreamEvent) => void;
