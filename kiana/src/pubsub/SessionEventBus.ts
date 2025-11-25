/**
 * SessionEventBus - In-memory pub-sub for session events
 *
 * Provides real-time event distribution to multiple subscribers
 * using EventEmitter. Each session has its own emitter instance.
 */

import EventEmitter from 'eventemitter3';
import type {
  ConversationEvent,
  EventCallback,
  ISessionEventBus,
  Unsubscribe,
} from './types';

/**
 * Internal event name for session events
 */
const EVENT_NAME = 'event';

/**
 * SessionEventBus implementation using EventEmitter3
 *
 * Features:
 * - Per-session event isolation
 * - Automatic sequence number assignment
 * - Subscriber count tracking
 * - Automatic cleanup when no subscribers remain
 */
export class SessionEventBus implements ISessionEventBus {
  /** Emitters per session */
  private emitters = new Map<string, EventEmitter>();

  /** Sequence counters per session */
  private sequences = new Map<string, number>();

  /** Debug logging flag */
  private debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false;
  }

  /**
   * Subscribe to events for a session
   * @param sessionId - Session to subscribe to
   * @param callback - Function called for each event
   * @returns Unsubscribe function
   */
  subscribe(sessionId: string, callback: EventCallback): Unsubscribe {
    // Create emitter for session if needed
    if (!this.emitters.has(sessionId)) {
      this.emitters.set(sessionId, new EventEmitter());
      this.sequences.set(sessionId, 0);
      if (this.debug) {
        console.log(`[SessionEventBus] Created emitter for session: ${sessionId}`);
      }
    }

    const emitter = this.emitters.get(sessionId)!;
    emitter.on(EVENT_NAME, callback);

    if (this.debug) {
      console.log(`[SessionEventBus] Subscriber added for session: ${sessionId}, count: ${emitter.listenerCount(EVENT_NAME)}`);
    }

    // Return unsubscribe function
    return () => {
      emitter.off(EVENT_NAME, callback);

      if (this.debug) {
        console.log(`[SessionEventBus] Subscriber removed for session: ${sessionId}, count: ${emitter.listenerCount(EVENT_NAME)}`);
      }

      // Cleanup if no more subscribers
      if (emitter.listenerCount(EVENT_NAME) === 0) {
        this.cleanup(sessionId);
      }
    };
  }

  /**
   * Publish an event to all subscribers of a session
   * @param sessionId - Session to publish to
   * @param event - Event to publish (seq will be assigned)
   */
  publish(sessionId: string, event: Omit<ConversationEvent, 'seq'>): void {
    const emitter = this.emitters.get(sessionId);

    // Assign sequence number
    const currentSeq = this.sequences.get(sessionId) || 0;
    const seq = currentSeq + 1;
    this.sequences.set(sessionId, seq);

    const fullEvent: ConversationEvent = {
      ...event,
      seq,
    };

    if (this.debug) {
      console.log(`[SessionEventBus] Publishing event to session: ${sessionId}, seq: ${seq}, type: ${event.type}`);
    }

    // Emit to subscribers if any exist
    if (emitter) {
      emitter.emit(EVENT_NAME, fullEvent);
    }
  }

  /**
   * Get the current sequence number for a session
   * @param sessionId - Session ID
   * @returns Current sequence number or 0 if session not tracked
   */
  getSequence(sessionId: string): number {
    return this.sequences.get(sessionId) || 0;
  }

  /**
   * Set the sequence number for a session (useful when loading from storage)
   * @param sessionId - Session ID
   * @param seq - Sequence number to set
   */
  setSequence(sessionId: string, seq: number): void {
    this.sequences.set(sessionId, seq);
  }

  /**
   * Get the number of subscribers for a session
   * @param sessionId - Session ID
   * @returns Number of subscribers
   */
  getSubscriberCount(sessionId: string): number {
    const emitter = this.emitters.get(sessionId);
    return emitter?.listenerCount(EVENT_NAME) || 0;
  }

  /**
   * Cleanup resources for a session
   * @param sessionId - Session ID to cleanup
   */
  cleanup(sessionId: string): void {
    const emitter = this.emitters.get(sessionId);
    if (emitter) {
      emitter.removeAllListeners();
      this.emitters.delete(sessionId);

      if (this.debug) {
        console.log(`[SessionEventBus] Cleaned up session: ${sessionId}`);
      }
    }
    // Note: We keep sequences for potential reconnection
    // Clear with clearSequence() if needed
  }

  /**
   * Clear sequence tracking for a session
   * @param sessionId - Session ID
   */
  clearSequence(sessionId: string): void {
    this.sequences.delete(sessionId);
  }

  /**
   * Get all active session IDs (sessions with subscribers)
   * @returns Array of session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.emitters.keys());
  }

  /**
   * Get all tracked session IDs (sessions with sequence numbers)
   * @returns Array of session IDs
   */
  getTrackedSessions(): string[] {
    return Array.from(this.sequences.keys());
  }

  /**
   * Check if a session has any subscribers
   * @param sessionId - Session ID
   * @returns True if session has subscribers
   */
  hasSubscribers(sessionId: string): boolean {
    return this.getSubscriberCount(sessionId) > 0;
  }

  /**
   * Cleanup all sessions and reset state
   */
  reset(): void {
    for (const emitter of this.emitters.values()) {
      emitter.removeAllListeners();
    }
    this.emitters.clear();
    this.sequences.clear();

    if (this.debug) {
      console.log(`[SessionEventBus] Reset complete`);
    }
  }

  /**
   * Get statistics about the event bus
   */
  getStats(): {
    activeSessions: number;
    trackedSessions: number;
    totalSubscribers: number;
  } {
    let totalSubscribers = 0;
    for (const emitter of this.emitters.values()) {
      totalSubscribers += emitter.listenerCount(EVENT_NAME);
    }

    return {
      activeSessions: this.emitters.size,
      trackedSessions: this.sequences.size,
      totalSubscribers,
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalEventBus: SessionEventBus | undefined;

/**
 * Get or create the global SessionEventBus instance
 */
export function getSessionEventBus(options?: { debug?: boolean }): SessionEventBus {
  if (!globalEventBus) {
    globalEventBus = new SessionEventBus(options);
  }
  return globalEventBus;
}

/**
 * Reset the global SessionEventBus (mainly for testing)
 */
export function resetSessionEventBus(): void {
  if (globalEventBus) {
    globalEventBus.reset();
    globalEventBus = undefined;
  }
}

/**
 * Create a new SessionEventBus instance (non-singleton)
 */
export function createSessionEventBus(options?: { debug?: boolean }): SessionEventBus {
  return new SessionEventBus(options);
}
