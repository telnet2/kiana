/**
 * SessionEventBus Tests
 *
 * Run with: bun test test/pubsub/SessionEventBus.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { EventEmitter } from 'events';

// Inline simplified types for testing (avoiding external ai dependency)
interface ConversationEvent<T = unknown> {
  ts: number;
  seq: number;
  type: string;
  sessionId: string;
  data: T;
}

type EventCallback = (event: ConversationEvent) => void;
type Unsubscribe = () => void;

// Inline the SessionEventBus implementation for testing
const EVENT_NAME = 'event';

class SessionEventBus {
  private emitters = new Map<string, EventEmitter>();
  private sequences = new Map<string, number>();
  private debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false;
  }

  subscribe(sessionId: string, callback: EventCallback): Unsubscribe {
    if (!this.emitters.has(sessionId)) {
      this.emitters.set(sessionId, new EventEmitter());
      this.sequences.set(sessionId, 0);
    }

    const emitter = this.emitters.get(sessionId)!;
    emitter.on(EVENT_NAME, callback);

    return () => {
      emitter.off(EVENT_NAME, callback);
      if (emitter.listenerCount(EVENT_NAME) === 0) {
        this.cleanup(sessionId);
      }
    };
  }

  publish(sessionId: string, event: Omit<ConversationEvent, 'seq'>): void {
    const emitter = this.emitters.get(sessionId);

    const currentSeq = this.sequences.get(sessionId) || 0;
    const seq = currentSeq + 1;
    this.sequences.set(sessionId, seq);

    const fullEvent: ConversationEvent = {
      ...event,
      seq,
    };

    if (emitter) {
      emitter.emit(EVENT_NAME, fullEvent);
    }
  }

  getSequence(sessionId: string): number {
    return this.sequences.get(sessionId) || 0;
  }

  setSequence(sessionId: string, seq: number): void {
    this.sequences.set(sessionId, seq);
  }

  getSubscriberCount(sessionId: string): number {
    const emitter = this.emitters.get(sessionId);
    return emitter?.listenerCount(EVENT_NAME) || 0;
  }

  cleanup(sessionId: string): void {
    const emitter = this.emitters.get(sessionId);
    if (emitter) {
      emitter.removeAllListeners();
      this.emitters.delete(sessionId);
    }
  }

  clearSequence(sessionId: string): void {
    this.sequences.delete(sessionId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.emitters.keys());
  }

  getTrackedSessions(): string[] {
    return Array.from(this.sequences.keys());
  }

  hasSubscribers(sessionId: string): boolean {
    return this.getSubscriberCount(sessionId) > 0;
  }

  reset(): void {
    for (const emitter of this.emitters.values()) {
      emitter.removeAllListeners();
    }
    this.emitters.clear();
    this.sequences.clear();
  }

  getStats(): { activeSessions: number; trackedSessions: number; totalSubscribers: number } {
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

describe('SessionEventBus', () => {
  let eventBus: SessionEventBus;

  beforeEach(() => {
    eventBus = new SessionEventBus();
  });

  afterEach(() => {
    eventBus.reset();
  });

  describe('subscribe', () => {
    test('should create emitter for new session', () => {
      const callback = () => {};
      eventBus.subscribe('session-1', callback);

      expect(eventBus.getSubscriberCount('session-1')).toBe(1);
      expect(eventBus.getActiveSessions()).toContain('session-1');
    });

    test('should support multiple subscribers per session', () => {
      const callback1 = () => {};
      const callback2 = () => {};

      eventBus.subscribe('session-1', callback1);
      eventBus.subscribe('session-1', callback2);

      expect(eventBus.getSubscriberCount('session-1')).toBe(2);
    });

    test('should return unsubscribe function', () => {
      const callback = () => {};
      const unsubscribe = eventBus.subscribe('session-1', callback);

      expect(eventBus.getSubscriberCount('session-1')).toBe(1);

      unsubscribe();

      expect(eventBus.getSubscriberCount('session-1')).toBe(0);
    });

    test('should cleanup session when last subscriber leaves', () => {
      const callback = () => {};
      const unsubscribe = eventBus.subscribe('session-1', callback);

      expect(eventBus.getActiveSessions()).toContain('session-1');

      unsubscribe();

      expect(eventBus.getActiveSessions()).not.toContain('session-1');
    });
  });

  describe('publish', () => {
    test('should deliver events to subscribers', () => {
      const receivedEvents: ConversationEvent[] = [];
      const callback = (event: ConversationEvent) => {
        receivedEvents.push(event);
      };

      eventBus.subscribe('session-1', callback);

      eventBus.publish('session-1', {
        ts: Date.now(),
        type: 'message',
        sessionId: 'session-1',
        data: { text: 'Hello' },
      });

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe('message');
      expect(receivedEvents[0].data).toEqual({ text: 'Hello' });
    });

    test('should assign sequential sequence numbers', () => {
      const receivedEvents: ConversationEvent[] = [];
      eventBus.subscribe('session-1', (e) => receivedEvents.push(e));

      eventBus.publish('session-1', { ts: 1, type: 'a', sessionId: 'session-1', data: null });
      eventBus.publish('session-1', { ts: 2, type: 'b', sessionId: 'session-1', data: null });
      eventBus.publish('session-1', { ts: 3, type: 'c', sessionId: 'session-1', data: null });

      expect(receivedEvents[0].seq).toBe(1);
      expect(receivedEvents[1].seq).toBe(2);
      expect(receivedEvents[2].seq).toBe(3);
    });

    test('should deliver to all subscribers', () => {
      const events1: ConversationEvent[] = [];
      const events2: ConversationEvent[] = [];

      eventBus.subscribe('session-1', (e) => events1.push(e));
      eventBus.subscribe('session-1', (e) => events2.push(e));

      eventBus.publish('session-1', {
        ts: Date.now(),
        type: 'test',
        sessionId: 'session-1',
        data: 'hello',
      });

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
    });

    test('should isolate events between sessions', () => {
      const events1: ConversationEvent[] = [];
      const events2: ConversationEvent[] = [];

      eventBus.subscribe('session-1', (e) => events1.push(e));
      eventBus.subscribe('session-2', (e) => events2.push(e));

      eventBus.publish('session-1', {
        ts: Date.now(),
        type: 'test',
        sessionId: 'session-1',
        data: 'for session 1',
      });

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(0);
    });

    test('should still track sequence even without subscribers', () => {
      // No subscribers, but publish should still track sequence
      eventBus.publish('session-1', { ts: 1, type: 'a', sessionId: 'session-1', data: null });
      eventBus.publish('session-1', { ts: 2, type: 'b', sessionId: 'session-1', data: null });

      expect(eventBus.getSequence('session-1')).toBe(2);
    });
  });

  describe('sequence management', () => {
    test('getSequence should return 0 for unknown session', () => {
      expect(eventBus.getSequence('unknown')).toBe(0);
    });

    test('setSequence should update sequence', () => {
      eventBus.setSequence('session-1', 100);
      expect(eventBus.getSequence('session-1')).toBe(100);
    });

    test('clearSequence should remove sequence tracking', () => {
      eventBus.setSequence('session-1', 50);
      eventBus.clearSequence('session-1');
      expect(eventBus.getSequence('session-1')).toBe(0);
    });
  });

  describe('cleanup', () => {
    test('should remove all listeners for session', () => {
      eventBus.subscribe('session-1', () => {});
      eventBus.subscribe('session-1', () => {});

      expect(eventBus.getSubscriberCount('session-1')).toBe(2);

      eventBus.cleanup('session-1');

      expect(eventBus.getSubscriberCount('session-1')).toBe(0);
      expect(eventBus.getActiveSessions()).not.toContain('session-1');
    });
  });

  describe('reset', () => {
    test('should clear all sessions and sequences', () => {
      eventBus.subscribe('session-1', () => {});
      eventBus.subscribe('session-2', () => {});
      eventBus.setSequence('session-3', 100);

      eventBus.reset();

      expect(eventBus.getActiveSessions().length).toBe(0);
      expect(eventBus.getTrackedSessions().length).toBe(0);
      expect(eventBus.getStats().totalSubscribers).toBe(0);
    });
  });

  describe('getStats', () => {
    test('should return accurate statistics', () => {
      eventBus.subscribe('session-1', () => {});
      eventBus.subscribe('session-1', () => {});
      eventBus.subscribe('session-2', () => {});
      eventBus.setSequence('session-3', 10);

      const stats = eventBus.getStats();

      expect(stats.activeSessions).toBe(2);
      expect(stats.trackedSessions).toBe(3);
      expect(stats.totalSubscribers).toBe(3);
    });
  });
});

console.log('SessionEventBus tests loaded');
