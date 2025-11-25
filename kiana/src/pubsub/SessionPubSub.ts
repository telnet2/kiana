/**
 * SessionPubSub - Combined service for real-time pub-sub and persistence
 *
 * Integrates SessionEventBus and ConversationStore to provide a unified
 * interface for publishing events to subscribers and persisting to storage.
 */

import type {
  ConversationEvent,
  ConversationSnapshot,
  EventCallback,
  IConversationStore,
  ISessionEventBus,
  ISessionPubSub,
  ReadOptions,
  Unsubscribe,
} from './types';
import { SessionEventBus, createSessionEventBus } from './SessionEventBus';
import { JSONLConversationStore, createConversationStore } from './ConversationStore';
import { createStateReconstructor, StateReconstructor } from './StateReconstructor';

/**
 * SessionPubSub - Combines event bus and persistent storage
 *
 * Usage:
 * ```typescript
 * const pubsub = createSessionPubSub('/data/sessions');
 *
 * // Publish event (goes to subscribers and storage)
 * await pubsub.publishAndPersist({
 *   ts: Date.now(),
 *   type: 'message',
 *   sessionId: 'session-123',
 *   data: { id: 'msg-1', role: 'user', parts: [...] },
 * });
 *
 * // Subscribe with history replay
 * const unsubscribe = await pubsub.subscribeWithReplay(
 *   'session-123',
 *   (event) => console.log('Event:', event),
 *   { replay: true, fromSeq: 0 }
 * );
 * ```
 */
export class SessionPubSub implements ISessionPubSub {
  public readonly eventBus: SessionEventBus;
  public readonly store: JSONLConversationStore;
  private debug: boolean;
  private reconstructors = new Map<string, StateReconstructor>();
  private snapshotThreshold: number;

  constructor(options: {
    basePath: string;
    debug?: boolean;
    bufferSize?: number;
    flushIntervalMs?: number;
    snapshotThreshold?: number;
  }) {
    this.debug = options.debug ?? false;
    this.snapshotThreshold = options.snapshotThreshold ?? 100;

    this.eventBus = createSessionEventBus({ debug: this.debug });
    this.store = createConversationStore(options.basePath, {
      debug: this.debug,
      bufferSize: options.bufferSize,
      flushIntervalMs: options.flushIntervalMs,
    });
  }

  /**
   * Publish an event to both the event bus and persistent storage
   */
  async publishAndPersist(event: Omit<ConversationEvent, 'seq'>): Promise<void> {
    // Get and increment sequence number
    const seq = this.eventBus.getSequence(event.sessionId) + 1;
    this.eventBus.setSequence(event.sessionId, seq);

    const fullEvent: ConversationEvent = {
      ...event,
      seq,
    };

    // Emit to subscribers (use emit, not publish, to avoid double-incrementing seq)
    this.eventBus.emit(event.sessionId, fullEvent);

    // Persist to storage
    await this.store.append(fullEvent);

    // Update reconstructor if one exists
    const reconstructor = this.reconstructors.get(event.sessionId);
    if (reconstructor) {
      reconstructor.apply(fullEvent);
    }

    if (this.debug) {
      console.log(`[SessionPubSub] Published event: session=${event.sessionId}, seq=${seq}, type=${event.type}`);
    }
  }

  /**
   * Subscribe to session events with optional history replay
   */
  async subscribeWithReplay(
    sessionId: string,
    callback: EventCallback,
    options?: { fromSeq?: number; replay?: boolean }
  ): Promise<Unsubscribe> {
    const fromSeq = options?.fromSeq ?? 0;
    const replay = options?.replay ?? true;

    if (replay) {
      // Load history from storage
      const snapshot = await this.store.getLatestSnapshot(sessionId);
      const startSeq = snapshot ? snapshot.seq + 1 : fromSeq;

      // Read events after snapshot/fromSeq
      const events = await this.store.read(sessionId, { fromSeq: startSeq });

      // Send snapshot first if available
      if (snapshot && snapshot.seq >= fromSeq) {
        callback(snapshot);
      }

      // Send historical events
      for (const event of events) {
        callback(event);
      }

      // Update event bus sequence to match storage
      const lastEvent = events[events.length - 1];
      if (lastEvent) {
        const currentSeq = this.eventBus.getSequence(sessionId);
        if (lastEvent.seq > currentSeq) {
          this.eventBus.setSequence(sessionId, lastEvent.seq);
        }
      }

      if (this.debug) {
        console.log(`[SessionPubSub] Replayed ${events.length} events for session: ${sessionId}`);
      }
    }

    // Subscribe to live events
    return this.eventBus.subscribe(sessionId, callback);
  }

  /**
   * Get or create a state reconstructor for a session
   */
  async getReconstructor(sessionId: string): Promise<StateReconstructor> {
    let reconstructor = this.reconstructors.get(sessionId);

    if (!reconstructor) {
      reconstructor = createStateReconstructor({
        snapshotInterval: this.snapshotThreshold,
        onSnapshot: async (snapshot) => {
          await this.store.saveSnapshot(sessionId, snapshot);
        },
      });

      // Load existing state
      const snapshot = await this.store.getLatestSnapshot(sessionId);
      if (snapshot) {
        reconstructor.loadSnapshot(snapshot.data);
        const events = await this.store.read(sessionId, { fromSeq: snapshot.seq + 1 });
        reconstructor.applyAll(events);
      } else {
        const events = await this.store.read(sessionId);
        reconstructor.applyAll(events);
      }

      this.reconstructors.set(sessionId, reconstructor);
    }

    return reconstructor;
  }

  /**
   * Get current conversation state for a session
   */
  async getConversationState(sessionId: string) {
    const reconstructor = await this.getReconstructor(sessionId);
    return reconstructor.getState();
  }

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string) {
    const reconstructor = await this.getReconstructor(sessionId);
    return reconstructor.getMessages();
  }

  /**
   * Read events from storage
   */
  async readEvents(sessionId: string, options?: ReadOptions) {
    return this.store.read(sessionId, options);
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    return this.store.exists(sessionId);
  }

  /**
   * Delete session and cleanup
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.eventBus.cleanup(sessionId);
    this.eventBus.clearSequence(sessionId);
    this.reconstructors.delete(sessionId);
    await this.store.delete(sessionId);
  }

  /**
   * Flush pending writes for a session
   */
  async flush(sessionId: string): Promise<void> {
    await this.store.flush(sessionId);
  }

  /**
   * Flush all and close
   */
  async close(): Promise<void> {
    this.eventBus.reset();
    this.reconstructors.clear();
    await this.store.close();
  }

  /**
   * Get statistics
   */
  async getStats() {
    const busStats = this.eventBus.getStats();
    const storeStats = await this.store.getStats();

    return {
      eventBus: busStats,
      store: storeStats,
      reconstructors: this.reconstructors.size,
    };
  }
}

/**
 * Factory function to create SessionPubSub
 */
export function createSessionPubSub(
  basePath: string,
  options?: {
    debug?: boolean;
    bufferSize?: number;
    flushIntervalMs?: number;
    snapshotThreshold?: number;
  }
): SessionPubSub {
  return new SessionPubSub({
    basePath,
    ...options,
  });
}

/**
 * Singleton instance management
 */
let globalPubSub: SessionPubSub | undefined;

/**
 * Get or create global SessionPubSub instance
 */
export function getSessionPubSub(
  basePath?: string,
  options?: {
    debug?: boolean;
    bufferSize?: number;
    flushIntervalMs?: number;
    snapshotThreshold?: number;
  }
): SessionPubSub {
  if (!globalPubSub) {
    if (!basePath) {
      throw new Error('basePath is required when creating SessionPubSub for the first time');
    }
    globalPubSub = createSessionPubSub(basePath, options);
  }
  return globalPubSub;
}

/**
 * Reset global SessionPubSub (mainly for testing)
 */
export async function resetSessionPubSub(): Promise<void> {
  if (globalPubSub) {
    await globalPubSub.close();
    globalPubSub = undefined;
  }
}
