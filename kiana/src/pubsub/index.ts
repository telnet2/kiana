/**
 * Kiana Session Pub-Sub Module
 *
 * Provides infrastructure for:
 * - Storing session conversations in JSONL format
 * - Real-time pub-sub for multiple clients monitoring conversations
 * - History replay for new clients joining a session
 *
 * @module pubsub
 */

// Types
export type {
  ConversationEvent,
  ConversationEventType,
  ConversationSnapshot,
  ConversationState,
  ErrorData,
  EventCallback,
  IConversationStore,
  ISessionEventBus,
  ISessionPubSub,
  MessageEvent,
  ChunkEvent,
  ToolExecEvent,
  ErrorEvent,
  MetadataEvent,
  SnapshotEvent,
  ReadOptions,
  SessionMetadata,
  ToolExecutionData,
  UIMessageChunk,
  Unsubscribe,
} from './types';

// SessionEventBus
export {
  SessionEventBus,
  createSessionEventBus,
  getSessionEventBus,
  resetSessionEventBus,
} from './SessionEventBus';

// ConversationStore
export {
  JSONLConversationStore,
  createConversationStore,
} from './ConversationStore';

// StateReconstructor
export {
  StateReconstructor,
  createStateReconstructor,
  applyEvent,
  reconstructState,
  reconstructFromSnapshot,
  createSnapshot,
} from './StateReconstructor';

// SessionPubSub (main entry point)
export {
  SessionPubSub,
  createSessionPubSub,
  getSessionPubSub,
  resetSessionPubSub,
} from './SessionPubSub';
