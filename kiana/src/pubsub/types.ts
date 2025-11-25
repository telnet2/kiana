/**
 * Kiana Session Pub-Sub Types
 *
 * Types for storing session conversations in JSONL format and
 * supporting pub-sub for multiple clients with history replay.
 */

import type { UIMessage } from 'ai';

/**
 * Stream chunk types from AI SDK v6
 * Simplified version of UIMessageChunk for storage
 */
export type UIMessageChunk =
  | { type: 'start'; messageId?: string; messageMetadata?: unknown }
  | { type: 'text-start'; id: string; providerMetadata?: unknown }
  | { type: 'text-delta'; id: string; delta: string; providerMetadata?: unknown }
  | { type: 'text-end'; id: string; providerMetadata?: unknown }
  | { type: 'reasoning-start'; id: string; providerMetadata?: unknown }
  | { type: 'reasoning-delta'; id: string; delta: string; providerMetadata?: unknown }
  | { type: 'reasoning-end'; id: string; providerMetadata?: unknown }
  | { type: 'tool-input-start'; toolCallId: string; toolName: string; dynamic?: boolean; title?: string }
  | { type: 'tool-input-delta'; toolCallId: string; inputTextDelta: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown; dynamic?: boolean; providerMetadata?: unknown; title?: string }
  | { type: 'tool-input-error'; toolCallId: string; toolName: string; input: unknown; errorText: string; dynamic?: boolean; title?: string }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown; dynamic?: boolean; preliminary?: boolean }
  | { type: 'tool-output-error'; toolCallId: string; errorText: string; dynamic?: boolean }
  | { type: 'tool-output-denied'; toolCallId: string }
  | { type: 'tool-approval-request'; approvalId: string; toolCallId: string }
  | { type: 'source-url'; sourceId: string; url: string; title?: string }
  | { type: 'source-document'; sourceId: string; mediaType: string; title: string; filename?: string }
  | { type: 'file'; url: string; mediaType: string }
  | { type: 'start-step' }
  | { type: 'finish-step' }
  | { type: 'finish'; finishReason?: string; messageMetadata?: unknown }
  | { type: 'abort' }
  | { type: 'error'; errorText: string }
  | { type: 'message-metadata'; messageMetadata: unknown }
  | { type: `data-${string}`; id?: string; data: unknown; transient?: boolean };

/**
 * Event types for conversation storage
 */
export type ConversationEventType =
  | 'message'      // Complete UIMessage (user or finalized assistant)
  | 'chunk'        // Stream chunk (text-delta, tool-*, etc.)
  | 'tool_exec'    // Tool execution metadata
  | 'error'        // Error event
  | 'metadata'     // Session metadata update
  | 'snapshot';    // State snapshot for fast replay

/**
 * Main event wrapper for JSONL storage
 */
export interface ConversationEvent<T = unknown> {
  /** Unix timestamp in milliseconds */
  ts: number;

  /** Sequence number for ordering (assigned by EventBus) */
  seq: number;

  /** Event type */
  type: ConversationEventType;

  /** Session identifier */
  sessionId: string;

  /** Event payload */
  data: T;
}

/**
 * Typed event helpers
 */
export type MessageEvent = ConversationEvent<UIMessage> & { type: 'message' };
export type ChunkEvent = ConversationEvent<UIMessageChunk> & { type: 'chunk' };
export type ToolExecEvent = ConversationEvent<ToolExecutionData> & { type: 'tool_exec' };
export type ErrorEvent = ConversationEvent<ErrorData> & { type: 'error' };
export type MetadataEvent = ConversationEvent<Record<string, unknown>> & { type: 'metadata' };
export type SnapshotEvent = ConversationEvent<ConversationSnapshot> & { type: 'snapshot' };

/**
 * Tool execution data for logging
 */
export interface ToolExecutionData {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
  startedAt: number;
  completedAt?: number;
}

/**
 * Error data
 */
export interface ErrorData {
  code?: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

/**
 * Conversation state snapshot for fast replay
 */
export interface ConversationSnapshot {
  /** Messages finalized at snapshot time */
  messages: UIMessage[];

  /** Current in-progress assistant message (if any) */
  currentMessage?: Partial<UIMessage>;

  /** Pending tool calls awaiting results */
  pendingToolCalls?: Record<string, {
    toolName: string;
    input: unknown;
    startedAt: number;
  }>;

  /** Snapshot creation timestamp */
  createdAt: number;

  /** Sequence number at snapshot time */
  atSeq: number;
}

/**
 * Options for reading events from store
 */
export interface ReadOptions {
  /** Start from sequence number (inclusive) */
  fromSeq?: number;

  /** End at sequence number (inclusive) */
  toSeq?: number;

  /** Start from timestamp (inclusive) */
  fromTs?: number;

  /** End at timestamp (inclusive) */
  toTs?: number;

  /** Maximum events to return */
  limit?: number;

  /** Filter by event types */
  types?: ConversationEventType[];

  /** Skip streaming chunks, only return messages */
  messagesOnly?: boolean;
}

/**
 * Session metadata stored alongside events
 */
export interface SessionMetadata {
  sessionId: string;
  createdAt: number;
  lastEventAt: number;
  eventCount: number;
  byteSize: number;
  messageCount: number;
  lastSnapshotSeq?: number;
}

/**
 * Event callback type for subscriptions
 */
export type EventCallback = (event: ConversationEvent) => void;

/**
 * Unsubscribe function returned from subscribe
 */
export type Unsubscribe = () => void;

/**
 * Session event bus interface
 */
export interface ISessionEventBus {
  /** Subscribe to session events */
  subscribe(sessionId: string, callback: EventCallback): Unsubscribe;

  /** Publish event to all subscribers */
  publish(sessionId: string, event: Omit<ConversationEvent, 'seq'>): void;

  /** Get subscriber count for a session */
  getSubscriberCount(sessionId: string): number;

  /** Cleanup session resources */
  cleanup(sessionId: string): void;

  /** Get all active session IDs */
  getActiveSessions(): string[];
}

/**
 * Conversation store interface
 */
export interface IConversationStore {
  /** Append event to session log */
  append(event: ConversationEvent): Promise<void>;

  /** Read events from session */
  read(sessionId: string, options?: ReadOptions): Promise<ConversationEvent[]>;

  /** Stream events from session (async iterator) */
  stream(sessionId: string, fromSeq?: number): AsyncIterable<ConversationEvent>;

  /** Get session metadata */
  getMetadata(sessionId: string): Promise<SessionMetadata | null>;

  /** Save snapshot for faster replay */
  saveSnapshot(sessionId: string, snapshot: ConversationSnapshot): Promise<void>;

  /** Get latest snapshot */
  getLatestSnapshot(sessionId: string): Promise<SnapshotEvent | null>;

  /** Check if session exists */
  exists(sessionId: string): Promise<boolean>;

  /** Delete session data */
  delete(sessionId: string): Promise<void>;

  /** Flush any buffered writes */
  flush(sessionId: string): Promise<void>;

  /** Close store and release resources */
  close(): Promise<void>;
}

/**
 * Combined service interface
 */
export interface ISessionPubSub {
  /** Event bus for real-time subscriptions */
  eventBus: ISessionEventBus;

  /** Persistent storage for events */
  store: IConversationStore;

  /** Publish event to both bus and store */
  publishAndPersist(event: Omit<ConversationEvent, 'seq'>): Promise<void>;

  /** Subscribe with history replay */
  subscribeWithReplay(
    sessionId: string,
    callback: EventCallback,
    options?: { fromSeq?: number; replay?: boolean }
  ): Promise<Unsubscribe>;
}

/**
 * Reconstruct conversation state from events
 */
export interface ConversationState {
  /** Finalized messages */
  messages: UIMessage[];

  /** Current in-progress assistant message */
  currentMessage: Partial<UIMessage> | null;

  /** Text parts being streamed, keyed by part ID */
  streamingText: Map<string, string>;

  /** Pending tool calls awaiting results */
  pendingToolCalls: Map<string, { toolName: string; input: unknown }>;

  /** Last processed sequence number */
  lastSeq: number;

  /** Last event timestamp */
  lastTs: number;
}

/**
 * Factory function types
 */
export type CreateEventBus = () => ISessionEventBus;
export type CreateConversationStore = (basePath: string) => IConversationStore;
export type CreateSessionPubSub = (basePath: string) => ISessionPubSub;
