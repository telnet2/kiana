/**
 * StateReconstructor Tests
 *
 * Run with: bun test test/pubsub/StateReconstructor.test.ts
 */

import { describe, test, expect, beforeEach } from 'bun:test';

// Inline simplified types for testing
interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: any[];
  metadata?: unknown;
}

interface ConversationEvent<T = unknown> {
  ts: number;
  seq: number;
  type: 'message' | 'chunk' | 'tool_exec' | 'error' | 'metadata' | 'snapshot';
  sessionId: string;
  data: T;
}

type UIMessageChunk =
  | { type: 'start'; messageId?: string; messageMetadata?: unknown }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-input-start'; toolCallId: string; toolName: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown }
  | { type: 'tool-output-error'; toolCallId: string; errorText: string }
  | { type: 'finish'; finishReason?: string; messageMetadata?: unknown }
  | { type: 'abort' }
  | { type: 'error'; errorText: string };

interface ConversationSnapshot {
  messages: UIMessage[];
  currentMessage?: Partial<UIMessage>;
  pendingToolCalls?: Record<string, { toolName: string; input: unknown; startedAt: number }>;
  createdAt: number;
  atSeq: number;
}

interface ConversationState {
  messages: UIMessage[];
  currentMessage: Partial<UIMessage> | null;
  streamingText: Map<string, string>;
  pendingToolCalls: Map<string, { toolName: string; input: unknown }>;
  lastSeq: number;
  lastTs: number;
}

// Inline StateReconstructor for testing
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

function applyEvent(state: ConversationState, event: ConversationEvent): ConversationState {
  state.lastSeq = Math.max(state.lastSeq, event.seq);
  state.lastTs = Math.max(state.lastTs, event.ts);

  switch (event.type) {
    case 'message':
      return applyMessageEvent(state, event.data as UIMessage);
    case 'chunk':
      return applyChunkEvent(state, event.data as UIMessageChunk);
    case 'snapshot':
      return applySnapshotEvent(state, event.data as ConversationSnapshot);
    default:
      return state;
  }
}

function applyMessageEvent(state: ConversationState, message: UIMessage): ConversationState {
  const existingIndex = state.messages.findIndex((m) => m.id === message.id);
  if (existingIndex >= 0) {
    state.messages[existingIndex] = message;
  } else {
    state.messages.push(message);
  }
  if (state.currentMessage?.id === message.id) {
    state.currentMessage = null;
    state.streamingText.clear();
  }
  return state;
}

function applyChunkEvent(state: ConversationState, chunk: UIMessageChunk): ConversationState {
  switch (chunk.type) {
    case 'start':
      state.currentMessage = {
        id: chunk.messageId || `msg-${Date.now()}`,
        role: 'assistant',
        parts: [],
        metadata: chunk.messageMetadata,
      };
      state.streamingText.clear();
      break;

    case 'text-start':
      state.streamingText.set(chunk.id, '');
      break;

    case 'text-delta':
      const currentText = state.streamingText.get(chunk.id) || '';
      state.streamingText.set(chunk.id, currentText + chunk.delta);
      if (state.currentMessage) {
        updateTextPart(state.currentMessage, chunk.id, state.streamingText.get(chunk.id)!);
      }
      break;

    case 'text-end':
      if (state.currentMessage) {
        const textPart = findTextPart(state.currentMessage, chunk.id);
        if (textPart) textPart.state = 'done';
      }
      break;

    case 'tool-input-start':
      state.pendingToolCalls.set(chunk.toolCallId, {
        toolName: chunk.toolName,
        input: undefined,
      });
      if (state.currentMessage) {
        addToolPart(state.currentMessage, chunk.toolCallId, chunk.toolName, {
          state: 'input-streaming',
        });
      }
      break;

    case 'tool-input-available':
      state.pendingToolCalls.set(chunk.toolCallId, {
        toolName: chunk.toolName,
        input: chunk.input,
      });
      if (state.currentMessage) {
        updateToolPart(state.currentMessage, chunk.toolCallId, {
          state: 'input-available',
          input: chunk.input,
        });
      }
      break;

    case 'tool-output-available':
      if (state.currentMessage) {
        updateToolPart(state.currentMessage, chunk.toolCallId, {
          state: 'output-available',
          output: chunk.output,
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

    case 'finish':
      if (state.currentMessage) {
        const finalMessage: UIMessage = {
          id: state.currentMessage.id!,
          role: state.currentMessage.role as 'assistant',
          parts: state.currentMessage.parts || [],
          metadata: chunk.messageMetadata ?? state.currentMessage.metadata,
        };
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
      state.currentMessage = null;
      state.streamingText.clear();
      state.pendingToolCalls.clear();
      break;
  }

  return state;
}

function applySnapshotEvent(state: ConversationState, snapshot: ConversationSnapshot): ConversationState {
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

function findTextPart(message: Partial<UIMessage>, id: string): any {
  return message.parts?.find((p: any) => p.type === 'text' && p.id === id);
}

function updateTextPart(message: Partial<UIMessage>, id: string, text: string): void {
  if (!message.parts) message.parts = [];
  let textPart = findTextPart(message, id);
  if (!textPart) {
    textPart = { type: 'text', id, text: '', state: 'streaming' };
    message.parts.push(textPart);
  }
  textPart.text = text;
}

function addToolPart(message: Partial<UIMessage>, toolCallId: string, toolName: string, data: any): void {
  if (!message.parts) message.parts = [];
  message.parts.push({ type: 'dynamic-tool', toolName, toolCallId, ...data });
}

function updateToolPart(message: Partial<UIMessage>, toolCallId: string, updates: any): void {
  if (!message.parts) return;
  const toolPart = message.parts.find((p: any) => p.toolCallId === toolCallId);
  if (toolPart) Object.assign(toolPart, updates);
}

function reconstructState(events: ConversationEvent[]): ConversationState {
  const state = createInitialState();
  for (const event of events) {
    applyEvent(state, event);
  }
  return state;
}

function createSnapshot(state: ConversationState): ConversationSnapshot {
  const pendingToolCalls: Record<string, { toolName: string; input: unknown; startedAt: number }> = {};
  for (const [id, data] of state.pendingToolCalls) {
    pendingToolCalls[id] = { toolName: data.toolName, input: data.input, startedAt: state.lastTs };
  }
  return {
    messages: [...state.messages],
    currentMessage: state.currentMessage ? { ...state.currentMessage } : undefined,
    pendingToolCalls: Object.keys(pendingToolCalls).length > 0 ? pendingToolCalls : undefined,
    createdAt: Date.now(),
    atSeq: state.lastSeq,
  };
}

// StateReconstructor class
class StateReconstructor {
  private state: ConversationState;

  constructor(initialState?: ConversationState) {
    this.state = initialState || createInitialState();
  }

  getState(): ConversationState {
    return this.state;
  }

  getMessages(): UIMessage[] {
    return [...this.state.messages];
  }

  getCurrentMessage(): Partial<UIMessage> | null {
    return this.state.currentMessage;
  }

  apply(event: ConversationEvent): void {
    this.state = applyEvent(this.state, event);
  }

  applyAll(events: ConversationEvent[]): void {
    for (const event of events) {
      this.apply(event);
    }
  }

  reset(): void {
    this.state = createInitialState();
  }

  loadSnapshot(snapshot: ConversationSnapshot): void {
    this.state = createInitialState();
    applySnapshotEvent(this.state, snapshot);
  }

  createSnapshot(): ConversationSnapshot {
    return createSnapshot(this.state);
  }

  isStreaming(): boolean {
    return this.state.currentMessage !== null;
  }

  getPendingToolCallCount(): number {
    return this.state.pendingToolCalls.size;
  }
}

// Helper to create events
const sessionId = 'test-session';
let seqCounter = 0;

function makeEvent<T>(type: ConversationEvent['type'], data: T): ConversationEvent<T> {
  return { ts: Date.now(), seq: ++seqCounter, type, sessionId, data };
}

function makeChunkEvent(chunk: UIMessageChunk): ConversationEvent<UIMessageChunk> {
  return makeEvent('chunk', chunk);
}

describe('StateReconstructor', () => {
  let reconstructor: StateReconstructor;

  beforeEach(() => {
    seqCounter = 0;
    reconstructor = new StateReconstructor();
  });

  describe('message events', () => {
    test('should add user message to state', () => {
      const userMessage: UIMessage = {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      };

      reconstructor.apply(makeEvent('message', userMessage));

      const messages = reconstructor.getMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].parts[0].text).toBe('Hello');
    });

    test('should update existing message', () => {
      const msg1: UIMessage = { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'v1' }] };
      const msg2: UIMessage = { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'v2' }] };

      reconstructor.apply(makeEvent('message', msg1));
      reconstructor.apply(makeEvent('message', msg2));

      const messages = reconstructor.getMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].parts[0].text).toBe('v2');
    });
  });

  describe('streaming text', () => {
    test('should reconstruct streamed text', () => {
      reconstructor.apply(makeChunkEvent({ type: 'start', messageId: 'msg-1' }));
      reconstructor.apply(makeChunkEvent({ type: 'text-start', id: 't1' }));
      reconstructor.apply(makeChunkEvent({ type: 'text-delta', id: 't1', delta: 'Hello' }));
      reconstructor.apply(makeChunkEvent({ type: 'text-delta', id: 't1', delta: ' World' }));
      reconstructor.apply(makeChunkEvent({ type: 'text-end', id: 't1' }));
      reconstructor.apply(makeChunkEvent({ type: 'finish' }));

      const messages = reconstructor.getMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].role).toBe('assistant');

      const textPart = messages[0].parts.find((p: any) => p.type === 'text');
      expect(textPart.text).toBe('Hello World');
      expect(textPart.state).toBe('done');
    });

    test('should track streaming state', () => {
      expect(reconstructor.isStreaming()).toBe(false);

      reconstructor.apply(makeChunkEvent({ type: 'start', messageId: 'msg-1' }));
      expect(reconstructor.isStreaming()).toBe(true);

      reconstructor.apply(makeChunkEvent({ type: 'finish' }));
      expect(reconstructor.isStreaming()).toBe(false);
    });

    test('should handle abort', () => {
      reconstructor.apply(makeChunkEvent({ type: 'start', messageId: 'msg-1' }));
      reconstructor.apply(makeChunkEvent({ type: 'text-delta', id: 't1', delta: 'partial' }));

      expect(reconstructor.isStreaming()).toBe(true);

      reconstructor.apply(makeChunkEvent({ type: 'abort' }));

      expect(reconstructor.isStreaming()).toBe(false);
      expect(reconstructor.getMessages().length).toBe(0);
    });
  });

  describe('tool calls', () => {
    test('should reconstruct tool call flow', () => {
      reconstructor.apply(makeChunkEvent({ type: 'start', messageId: 'msg-1' }));
      reconstructor.apply(makeChunkEvent({
        type: 'tool-input-start',
        toolCallId: 'tc1',
        toolName: 'search',
      }));

      expect(reconstructor.getPendingToolCallCount()).toBe(1);

      reconstructor.apply(makeChunkEvent({
        type: 'tool-input-available',
        toolCallId: 'tc1',
        toolName: 'search',
        input: { query: 'test' },
      }));

      reconstructor.apply(makeChunkEvent({
        type: 'tool-output-available',
        toolCallId: 'tc1',
        output: { results: ['a', 'b'] },
      }));

      expect(reconstructor.getPendingToolCallCount()).toBe(0);

      reconstructor.apply(makeChunkEvent({ type: 'finish' }));

      const messages = reconstructor.getMessages();
      expect(messages.length).toBe(1);

      const toolPart = messages[0].parts.find((p: any) => p.toolCallId === 'tc1');
      expect(toolPart).toBeDefined();
      expect(toolPart.toolName).toBe('search');
      expect(toolPart.state).toBe('output-available');
      expect(toolPart.input).toEqual({ query: 'test' });
      expect(toolPart.output).toEqual({ results: ['a', 'b'] });
    });

    test('should handle tool errors', () => {
      reconstructor.apply(makeChunkEvent({ type: 'start', messageId: 'msg-1' }));
      reconstructor.apply(makeChunkEvent({
        type: 'tool-input-start',
        toolCallId: 'tc1',
        toolName: 'failing_tool',
      }));
      reconstructor.apply(makeChunkEvent({
        type: 'tool-input-available',
        toolCallId: 'tc1',
        toolName: 'failing_tool',
        input: {},
      }));
      reconstructor.apply(makeChunkEvent({
        type: 'tool-output-error',
        toolCallId: 'tc1',
        errorText: 'Tool execution failed',
      }));
      reconstructor.apply(makeChunkEvent({ type: 'finish' }));

      const messages = reconstructor.getMessages();
      const toolPart = messages[0].parts.find((p: any) => p.toolCallId === 'tc1');
      expect(toolPart.state).toBe('output-error');
      expect(toolPart.errorText).toBe('Tool execution failed');
    });
  });

  describe('reconstructState function', () => {
    test('should reconstruct full conversation from events', () => {
      const events: ConversationEvent[] = [
        makeEvent('message', { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Hi' }] }),
        makeChunkEvent({ type: 'start', messageId: 'a1' }),
        makeChunkEvent({ type: 'text-delta', id: 't1', delta: 'Hello!' }),
        makeChunkEvent({ type: 'finish' }),
        makeEvent('message', { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'How are you?' }] }),
        makeChunkEvent({ type: 'start', messageId: 'a2' }),
        makeChunkEvent({ type: 'text-delta', id: 't2', delta: "I'm fine" }),
        makeChunkEvent({ type: 'finish' }),
      ];

      const state = reconstructState(events);

      expect(state.messages.length).toBe(4);
      expect(state.messages[0].id).toBe('u1');
      expect(state.messages[1].id).toBe('a1');
      expect(state.messages[2].id).toBe('u2');
      expect(state.messages[3].id).toBe('a2');
    });
  });

  describe('snapshots', () => {
    test('should create snapshot from state', () => {
      reconstructor.apply(makeEvent('message', { id: 'u1', role: 'user', parts: [] }));
      reconstructor.apply(makeChunkEvent({ type: 'start', messageId: 'a1' }));
      reconstructor.apply(makeChunkEvent({ type: 'text-delta', id: 't1', delta: 'Hello' }));
      reconstructor.apply(makeChunkEvent({ type: 'finish' }));

      const snapshot = reconstructor.createSnapshot();

      expect(snapshot.messages.length).toBe(2);
      expect(snapshot.atSeq).toBeGreaterThan(0);
    });

    test('should load state from snapshot', () => {
      const snapshot: ConversationSnapshot = {
        messages: [
          { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'saved' }] },
          { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'restored' }] },
        ],
        createdAt: Date.now(),
        atSeq: 100,
      };

      reconstructor.loadSnapshot(snapshot);

      expect(reconstructor.getMessages().length).toBe(2);
      expect(reconstructor.getState().lastSeq).toBe(100);
    });

    test('should restore pending tool calls from snapshot', () => {
      const snapshot: ConversationSnapshot = {
        messages: [],
        currentMessage: { id: 'msg-1', role: 'assistant', parts: [] },
        pendingToolCalls: {
          'tc1': { toolName: 'search', input: { q: 'test' }, startedAt: 1000 },
        },
        createdAt: Date.now(),
        atSeq: 50,
      };

      reconstructor.loadSnapshot(snapshot);

      expect(reconstructor.isStreaming()).toBe(true);
      expect(reconstructor.getPendingToolCallCount()).toBe(1);
    });
  });

  describe('reset', () => {
    test('should clear all state', () => {
      reconstructor.apply(makeEvent('message', { id: 'u1', role: 'user', parts: [] }));
      reconstructor.apply(makeChunkEvent({ type: 'start', messageId: 'a1' }));

      expect(reconstructor.getMessages().length).toBe(1);
      expect(reconstructor.isStreaming()).toBe(true);

      reconstructor.reset();

      expect(reconstructor.getMessages().length).toBe(0);
      expect(reconstructor.isStreaming()).toBe(false);
      expect(reconstructor.getState().lastSeq).toBe(0);
    });
  });
});

console.log('StateReconstructor tests loaded');
