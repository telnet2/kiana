/**
 * StateReconstructor - Rebuild conversation state from events
 *
 * Provides utilities to reconstruct the full conversation state
 * from a stream of events, enabling history replay for new clients.
 */

import type { UIMessage } from 'ai';
import type {
  ConversationEvent,
  ConversationSnapshot,
  ConversationState,
  UIMessageChunk,
} from './types';

/**
 * Default initial state
 */
function createInitialState(): ConversationState {
  return {
    messages: [],
    currentMessage: null,
    streamingText: new Map(),
    pendingToolCalls: new Map(),
    lastSeq: 0,
    lastTs: 0,
  };
}

/**
 * Apply a single event to the conversation state
 */
export function applyEvent(
  state: ConversationState,
  event: ConversationEvent
): ConversationState {
  // Update sequence and timestamp
  state.lastSeq = Math.max(state.lastSeq, event.seq);
  state.lastTs = Math.max(state.lastTs, event.ts);

  switch (event.type) {
    case 'message':
      return applyMessageEvent(state, event.data as UIMessage);

    case 'chunk':
      return applyChunkEvent(state, event.data as UIMessageChunk);

    case 'snapshot':
      return applySnapshotEvent(state, event.data as ConversationSnapshot);

    case 'error':
    case 'metadata':
    case 'tool_exec':
      // These don't affect conversation state
      return state;

    default:
      return state;
  }
}

/**
 * Apply a complete message to state
 */
function applyMessageEvent(state: ConversationState, message: UIMessage): ConversationState {
  // Add the message to the list
  const existingIndex = state.messages.findIndex((m) => m.id === message.id);

  if (existingIndex >= 0) {
    // Update existing message
    state.messages[existingIndex] = message;
  } else {
    // Add new message
    state.messages.push(message);
  }

  // If this was the current message being streamed, clear it
  if (state.currentMessage?.id === message.id) {
    state.currentMessage = null;
    state.streamingText.clear();
  }

  return state;
}

/**
 * Apply a stream chunk to state
 */
function applyChunkEvent(state: ConversationState, chunk: UIMessageChunk): ConversationState {
  switch (chunk.type) {
    case 'start':
      // Start a new assistant message
      state.currentMessage = {
        id: chunk.messageId || `msg-${Date.now()}`,
        role: 'assistant',
        parts: [],
        metadata: chunk.messageMetadata,
      };
      state.streamingText.clear();
      break;

    case 'text-start':
      // Initialize a text part
      state.streamingText.set(chunk.id, '');
      break;

    case 'text-delta':
      // Append to streaming text
      const currentText = state.streamingText.get(chunk.id) || '';
      state.streamingText.set(chunk.id, currentText + chunk.delta);

      // Update current message parts
      if (state.currentMessage) {
        updateTextPart(state.currentMessage, chunk.id, state.streamingText.get(chunk.id)!);
      }
      break;

    case 'text-end':
      // Mark text as done
      if (state.currentMessage) {
        const textPart = findTextPart(state.currentMessage, chunk.id);
        if (textPart) {
          (textPart as any).state = 'done';
        }
      }
      break;

    case 'reasoning-start':
      // Similar to text-start but for reasoning
      state.streamingText.set(`reasoning-${chunk.id}`, '');
      break;

    case 'reasoning-delta':
      const currentReasoning = state.streamingText.get(`reasoning-${chunk.id}`) || '';
      state.streamingText.set(`reasoning-${chunk.id}`, currentReasoning + chunk.delta);

      if (state.currentMessage) {
        updateReasoningPart(state.currentMessage, chunk.id, state.streamingText.get(`reasoning-${chunk.id}`)!);
      }
      break;

    case 'reasoning-end':
      if (state.currentMessage) {
        const reasoningPart = findReasoningPart(state.currentMessage, chunk.id);
        if (reasoningPart) {
          (reasoningPart as any).state = 'done';
        }
      }
      break;

    case 'tool-input-start':
      // Start tracking a tool call
      state.pendingToolCalls.set(chunk.toolCallId, {
        toolName: chunk.toolName,
        input: undefined,
      });

      if (state.currentMessage) {
        addToolPart(state.currentMessage, chunk.toolCallId, chunk.toolName, {
          state: 'input-streaming',
          input: undefined,
          dynamic: chunk.dynamic,
          title: chunk.title,
        });
      }
      break;

    case 'tool-input-available':
      // Tool input is complete
      state.pendingToolCalls.set(chunk.toolCallId, {
        toolName: chunk.toolName,
        input: chunk.input,
      });

      if (state.currentMessage) {
        updateToolPart(state.currentMessage, chunk.toolCallId, {
          state: 'input-available',
          input: chunk.input,
          callProviderMetadata: chunk.providerMetadata,
        });
      }
      break;

    case 'tool-input-error':
      if (state.currentMessage) {
        updateToolPart(state.currentMessage, chunk.toolCallId, {
          state: 'output-error',
          input: chunk.input,
          errorText: chunk.errorText,
        });
      }
      state.pendingToolCalls.delete(chunk.toolCallId);
      break;

    case 'tool-output-available':
      // Tool execution complete
      if (state.currentMessage) {
        updateToolPart(state.currentMessage, chunk.toolCallId, {
          state: 'output-available',
          output: chunk.output,
          preliminary: chunk.preliminary,
        });
      }
      state.pendingToolCalls.delete(chunk.toolCallId);
      break;

    case 'tool-output-error':
      if (state.currentMessage) {
        updateToolPart(state.currentMessage, chunk.toolCallId, {
          state: 'output-error',
          errorText: chunk.errorText,
        });
      }
      state.pendingToolCalls.delete(chunk.toolCallId);
      break;

    case 'tool-output-denied':
      if (state.currentMessage) {
        updateToolPart(state.currentMessage, chunk.toolCallId, {
          state: 'output-denied',
        });
      }
      state.pendingToolCalls.delete(chunk.toolCallId);
      break;

    case 'finish':
      // Finalize the current message
      if (state.currentMessage) {
        const finalMessage: UIMessage = {
          id: state.currentMessage.id!,
          role: state.currentMessage.role as 'user' | 'assistant' | 'system',
          parts: state.currentMessage.parts || [],
          metadata: chunk.messageMetadata ?? state.currentMessage.metadata,
        };

        // Add to messages if not already present
        const existingIdx = state.messages.findIndex((m) => m.id === finalMessage.id);
        if (existingIdx >= 0) {
          state.messages[existingIdx] = finalMessage;
        } else {
          state.messages.push(finalMessage);
        }

        state.currentMessage = null;
        state.streamingText.clear();
      }
      break;

    case 'abort':
      // Abort current message
      state.currentMessage = null;
      state.streamingText.clear();
      state.pendingToolCalls.clear();
      break;

    case 'error':
      // Log error but don't crash
      console.warn('[StateReconstructor] Error chunk:', chunk.errorText);
      break;

    default:
      // Handle data-* and other unknown types gracefully
      if (chunk.type.startsWith('data-') && state.currentMessage) {
        const dataChunk = chunk as { type: `data-${string}`; id?: string; data: unknown };
        addDataPart(state.currentMessage, dataChunk.type, dataChunk.id, dataChunk.data);
      }
      break;
  }

  return state;
}

/**
 * Apply a snapshot to state
 */
function applySnapshotEvent(
  state: ConversationState,
  snapshot: ConversationSnapshot
): ConversationState {
  state.messages = [...snapshot.messages];
  state.currentMessage = snapshot.currentMessage ? { ...snapshot.currentMessage } : null;
  state.lastSeq = snapshot.atSeq;
  state.lastTs = snapshot.createdAt;

  if (snapshot.pendingToolCalls) {
    state.pendingToolCalls = new Map(
      Object.entries(snapshot.pendingToolCalls).map(([id, data]) => [
        id,
        { toolName: data.toolName, input: data.input },
      ])
    );
  }

  return state;
}

/**
 * Helper to find or create text part in message
 */
function findTextPart(message: Partial<UIMessage>, id: string): any {
  return message.parts?.find((p) => (p as any).type === 'text' && (p as any).id === id);
}

/**
 * Helper to update or create text part
 */
function updateTextPart(message: Partial<UIMessage>, id: string, text: string): void {
  if (!message.parts) message.parts = [];

  let textPart = findTextPart(message, id);
  if (!textPart) {
    textPart = { type: 'text', id, text: '', state: 'streaming' };
    message.parts.push(textPart);
  }
  textPart.text = text;
}

/**
 * Helper to find reasoning part
 */
function findReasoningPart(message: Partial<UIMessage>, id: string): any {
  return message.parts?.find((p) => (p as any).type === 'reasoning' && (p as any).id === id);
}

/**
 * Helper to update or create reasoning part
 */
function updateReasoningPart(message: Partial<UIMessage>, id: string, text: string): void {
  if (!message.parts) message.parts = [];

  let reasoningPart = findReasoningPart(message, id);
  if (!reasoningPart) {
    reasoningPart = { type: 'reasoning', id, text: '', state: 'streaming' };
    message.parts.push(reasoningPart);
  }
  reasoningPart.text = text;
}

/**
 * Helper to add tool part
 */
function addToolPart(
  message: Partial<UIMessage>,
  toolCallId: string,
  toolName: string,
  data: Record<string, unknown>
): void {
  if (!message.parts) message.parts = [];

  const toolPart = {
    type: 'dynamic-tool',
    toolName,
    toolCallId,
    ...data,
  };
  message.parts.push(toolPart as any);
}

/**
 * Helper to update tool part
 */
function updateToolPart(
  message: Partial<UIMessage>,
  toolCallId: string,
  updates: Record<string, unknown>
): void {
  if (!message.parts) return;

  const toolPart = message.parts.find(
    (p) => (p as any).toolCallId === toolCallId
  ) as Record<string, unknown> | undefined;

  if (toolPart) {
    Object.assign(toolPart, updates);
  }
}

/**
 * Helper to add data part
 */
function addDataPart(
  message: Partial<UIMessage>,
  type: string,
  id: string | undefined,
  data: unknown
): void {
  if (!message.parts) message.parts = [];
  message.parts.push({ type, id, data } as any);
}

/**
 * Reconstruct full conversation state from events
 */
export function reconstructState(events: ConversationEvent[]): ConversationState {
  const state = createInitialState();

  for (const event of events) {
    applyEvent(state, event);
  }

  return state;
}

/**
 * Reconstruct state starting from a snapshot
 */
export function reconstructFromSnapshot(
  snapshot: ConversationSnapshot,
  events: ConversationEvent[]
): ConversationState {
  const state = createInitialState();

  // Apply snapshot first
  applySnapshotEvent(state, snapshot);

  // Apply events after snapshot
  for (const event of events) {
    if (event.seq > snapshot.atSeq) {
      applyEvent(state, event);
    }
  }

  return state;
}

/**
 * Create a snapshot from current state
 */
export function createSnapshot(state: ConversationState): ConversationSnapshot {
  const pendingToolCalls: Record<string, { toolName: string; input: unknown; startedAt: number }> = {};

  for (const [id, data] of state.pendingToolCalls) {
    pendingToolCalls[id] = {
      toolName: data.toolName,
      input: data.input,
      startedAt: state.lastTs,
    };
  }

  return {
    messages: [...state.messages],
    currentMessage: state.currentMessage ? { ...state.currentMessage } : undefined,
    pendingToolCalls: Object.keys(pendingToolCalls).length > 0 ? pendingToolCalls : undefined,
    createdAt: Date.now(),
    atSeq: state.lastSeq,
  };
}

/**
 * StateReconstructor class for incremental state updates
 */
export class StateReconstructor {
  private state: ConversationState;
  private eventBuffer: ConversationEvent[] = [];
  private snapshotInterval: number;
  private onSnapshot?: (snapshot: ConversationSnapshot) => void;

  constructor(options?: {
    initialState?: ConversationState;
    snapshotInterval?: number;
    onSnapshot?: (snapshot: ConversationSnapshot) => void;
  }) {
    this.state = options?.initialState || createInitialState();
    this.snapshotInterval = options?.snapshotInterval ?? 100;
    this.onSnapshot = options?.onSnapshot;
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.state;
  }

  /**
   * Get finalized messages only
   */
  getMessages(): UIMessage[] {
    return [...this.state.messages];
  }

  /**
   * Get current in-progress message (if any)
   */
  getCurrentMessage(): Partial<UIMessage> | null {
    return this.state.currentMessage;
  }

  /**
   * Apply a single event and update state
   */
  apply(event: ConversationEvent): void {
    this.state = applyEvent(this.state, event);
    this.eventBuffer.push(event);

    // Check if we should create a snapshot
    if (this.eventBuffer.length >= this.snapshotInterval && this.onSnapshot) {
      const snapshot = createSnapshot(this.state);
      this.onSnapshot(snapshot);
      this.eventBuffer = [];
    }
  }

  /**
   * Apply multiple events
   */
  applyAll(events: ConversationEvent[]): void {
    for (const event of events) {
      this.apply(event);
    }
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state = createInitialState();
    this.eventBuffer = [];
  }

  /**
   * Load from snapshot
   */
  loadSnapshot(snapshot: ConversationSnapshot): void {
    this.state = createInitialState();
    applySnapshotEvent(this.state, snapshot);
    this.eventBuffer = [];
  }

  /**
   * Create current snapshot
   */
  createSnapshot(): ConversationSnapshot {
    return createSnapshot(this.state);
  }

  /**
   * Check if there's an active streaming message
   */
  isStreaming(): boolean {
    return this.state.currentMessage !== null;
  }

  /**
   * Get number of pending tool calls
   */
  getPendingToolCallCount(): number {
    return this.state.pendingToolCalls.size;
  }
}

/**
 * Create a new StateReconstructor instance
 */
export function createStateReconstructor(options?: {
  initialState?: ConversationState;
  snapshotInterval?: number;
  onSnapshot?: (snapshot: ConversationSnapshot) => void;
}): StateReconstructor {
  return new StateReconstructor(options);
}
