/**
 * SessionPubSub Integration Tests
 *
 * Tests the full pub-sub flow with persistence and replay.
 * Run with: bun test test/pubsub/SessionPubSub.integration.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createInterface } from 'readline';

// ============ Inline Types ============

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
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'finish'; finishReason?: string; messageMetadata?: unknown };

type EventCallback = (event: ConversationEvent) => void;
type Unsubscribe = () => void;

// ============ Inline SessionEventBus ============

class SessionEventBus {
  private emitters = new Map<string, EventEmitter>();
  private sequences = new Map<string, number>();

  subscribe(sessionId: string, callback: EventCallback): Unsubscribe {
    if (!this.emitters.has(sessionId)) {
      this.emitters.set(sessionId, new EventEmitter());
      this.sequences.set(sessionId, 0);
    }
    const emitter = this.emitters.get(sessionId)!;
    emitter.on('event', callback);
    return () => {
      emitter.off('event', callback);
      if (emitter.listenerCount('event') === 0) {
        this.emitters.delete(sessionId);
      }
    };
  }

  publish(sessionId: string, event: Omit<ConversationEvent, 'seq'>): void {
    const seq = (this.sequences.get(sessionId) || 0) + 1;
    this.sequences.set(sessionId, seq);
    const fullEvent = { ...event, seq };
    const emitter = this.emitters.get(sessionId);
    if (emitter) emitter.emit('event', fullEvent);
  }

  getSequence(sessionId: string): number {
    return this.sequences.get(sessionId) || 0;
  }

  setSequence(sessionId: string, seq: number): void {
    this.sequences.set(sessionId, seq);
  }

  getSubscriberCount(sessionId: string): number {
    return this.emitters.get(sessionId)?.listenerCount('event') || 0;
  }

  cleanup(sessionId: string): void {
    this.emitters.get(sessionId)?.removeAllListeners();
    this.emitters.delete(sessionId);
  }

  clearSequence(sessionId: string): void {
    this.sequences.delete(sessionId);
  }

  reset(): void {
    for (const emitter of this.emitters.values()) {
      emitter.removeAllListeners();
    }
    this.emitters.clear();
    this.sequences.clear();
  }
}

// ============ Inline ConversationStore ============

class JSONLConversationStore {
  private basePath: string;
  private conversationsDir: string;
  private writeStreams = new Map<string, fs.WriteStream>();
  private writeBuffers = new Map<string, ConversationEvent[]>();
  private bufferSize: number;

  constructor(basePath: string, options?: { bufferSize?: number }) {
    this.basePath = basePath;
    this.conversationsDir = path.join(basePath, 'conversations');
    this.bufferSize = options?.bufferSize ?? 5;
  }

  private getFilePath(sessionId: string): string {
    return path.join(this.conversationsDir, `session-${sessionId}.jsonl`);
  }

  private async ensureDirs(): Promise<void> {
    await fs.promises.mkdir(this.conversationsDir, { recursive: true });
  }

  private async flushBuffer(sessionId: string): Promise<void> {
    const buffer = this.writeBuffers.get(sessionId);
    if (!buffer || buffer.length === 0) return;
    this.writeBuffers.set(sessionId, []);

    await this.ensureDirs();
    const filePath = this.getFilePath(sessionId);
    let stream = this.writeStreams.get(sessionId);
    if (!stream) {
      stream = fs.createWriteStream(filePath, { flags: 'a' });
      this.writeStreams.set(sessionId, stream);
    }

    for (const event of buffer) {
      await new Promise<void>((resolve, reject) => {
        stream!.write(JSON.stringify(event) + '\n', (err) => (err ? reject(err) : resolve()));
      });
    }
  }

  async append(event: ConversationEvent): Promise<void> {
    const sessionId = event.sessionId;
    let buffer = this.writeBuffers.get(sessionId);
    if (!buffer) {
      buffer = [];
      this.writeBuffers.set(sessionId, buffer);
    }
    buffer.push(event);
    if (buffer.length >= this.bufferSize) {
      await this.flushBuffer(sessionId);
    }
  }

  async read(sessionId: string, options?: { fromSeq?: number }): Promise<ConversationEvent[]> {
    const events: ConversationEvent[] = [];
    const filePath = this.getFilePath(sessionId);

    try {
      await fs.promises.access(filePath);
      const fileStream = fs.createReadStream(filePath);
      const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
      for await (const line of rl) {
        if (line.trim()) {
          try {
            events.push(JSON.parse(line));
          } catch {}
        }
      }
      rl.close();
      fileStream.destroy();
    } catch {}

    const buffer = this.writeBuffers.get(sessionId) || [];
    events.push(...buffer);

    if (options?.fromSeq !== undefined) {
      return events.filter((e) => e.seq >= options.fromSeq!);
    }
    return events;
  }

  async flush(sessionId: string): Promise<void> {
    await this.flushBuffer(sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    try {
      await fs.promises.access(this.getFilePath(sessionId));
      return true;
    } catch {
      return (this.writeBuffers.get(sessionId)?.length || 0) > 0;
    }
  }

  async delete(sessionId: string): Promise<void> {
    const stream = this.writeStreams.get(sessionId);
    if (stream) {
      await new Promise<void>((resolve) => stream.end(resolve));
      this.writeStreams.delete(sessionId);
    }
    this.writeBuffers.delete(sessionId);
    try {
      await fs.promises.unlink(this.getFilePath(sessionId));
    } catch {}
  }

  async close(): Promise<void> {
    for (const sessionId of this.writeBuffers.keys()) {
      await this.flushBuffer(sessionId);
    }
    for (const stream of this.writeStreams.values()) {
      await new Promise<void>((resolve) => stream.end(resolve));
    }
    this.writeStreams.clear();
  }
}

// ============ Inline SessionPubSub ============

class SessionPubSub {
  public readonly eventBus: SessionEventBus;
  public readonly store: JSONLConversationStore;

  constructor(basePath: string, options?: { bufferSize?: number }) {
    this.eventBus = new SessionEventBus();
    this.store = new JSONLConversationStore(basePath, options);
  }

  async publishAndPersist(event: Omit<ConversationEvent, 'seq'>): Promise<void> {
    const seq = this.eventBus.getSequence(event.sessionId) + 1;
    this.eventBus.setSequence(event.sessionId, seq);
    const fullEvent: ConversationEvent = { ...event, seq };

    // Emit directly to subscribers without going through publish (which increments seq again)
    const emitter = (this.eventBus as any).emitters.get(event.sessionId);
    if (emitter) {
      emitter.emit('event', fullEvent);
    }
    await this.store.append(fullEvent);
  }

  async subscribeWithReplay(
    sessionId: string,
    callback: EventCallback,
    options?: { fromSeq?: number; replay?: boolean }
  ): Promise<Unsubscribe> {
    const fromSeq = options?.fromSeq ?? 0;
    const replay = options?.replay ?? true;

    if (replay) {
      const events = await this.store.read(sessionId, { fromSeq });
      for (const event of events) {
        callback(event);
      }
      const lastEvent = events[events.length - 1];
      if (lastEvent) {
        const currentSeq = this.eventBus.getSequence(sessionId);
        if (lastEvent.seq > currentSeq) {
          this.eventBus.setSequence(sessionId, lastEvent.seq);
        }
      }
    }

    return this.eventBus.subscribe(sessionId, callback);
  }

  async flush(sessionId: string): Promise<void> {
    await this.store.flush(sessionId);
  }

  async close(): Promise<void> {
    this.eventBus.reset();
    await this.store.close();
  }
}

// ============ Test Helpers ============

const TEST_DIR = '/tmp/kiana-pubsub-integration-' + Date.now();

async function cleanupTestDir() {
  try {
    await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ Tests ============

describe('SessionPubSub Integration', () => {
  let pubsub: SessionPubSub;

  beforeEach(async () => {
    await cleanupTestDir();
    pubsub = new SessionPubSub(TEST_DIR, { bufferSize: 2 });
  });

  afterEach(async () => {
    await pubsub.close();
    await cleanupTestDir();
  });

  describe('publish and subscribe', () => {
    test('should deliver events to active subscribers', async () => {
      const received: ConversationEvent[] = [];
      const sessionId = 'session-1';

      pubsub.eventBus.subscribe(sessionId, (e) => received.push(e));

      await pubsub.publishAndPersist({
        ts: Date.now(),
        type: 'message',
        sessionId,
        data: { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      });

      expect(received.length).toBe(1);
      expect(received[0].seq).toBe(1);
      expect((received[0].data as any).parts[0].text).toBe('Hello');
    });

    test('should persist events to storage', async () => {
      const sessionId = 'persist-test';

      await pubsub.publishAndPersist({
        ts: 1000,
        type: 'message',
        sessionId,
        data: { text: 'persisted' },
      });

      await pubsub.flush(sessionId);

      const events = await pubsub.store.read(sessionId);
      expect(events.length).toBe(1);
      expect((events[0].data as any).text).toBe('persisted');
    });

    test('should assign sequential sequence numbers', async () => {
      const sessionId = 'seq-test';
      const received: ConversationEvent[] = [];

      pubsub.eventBus.subscribe(sessionId, (e) => received.push(e));

      await pubsub.publishAndPersist({ ts: 1, type: 'chunk', sessionId, data: 'a' });
      await pubsub.publishAndPersist({ ts: 2, type: 'chunk', sessionId, data: 'b' });
      await pubsub.publishAndPersist({ ts: 3, type: 'chunk', sessionId, data: 'c' });

      expect(received.map((e) => e.seq)).toEqual([1, 2, 3]);
    });
  });

  describe('subscribeWithReplay', () => {
    test('should replay history for new subscriber', async () => {
      const sessionId = 'replay-test';

      // Publish some events without subscriber
      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId, data: 'msg1' });
      await pubsub.publishAndPersist({ ts: 200, type: 'chunk', sessionId, data: 'chunk1' });
      await pubsub.publishAndPersist({ ts: 300, type: 'message', sessionId, data: 'msg2' });
      await pubsub.flush(sessionId);

      // New subscriber should get replay
      const received: ConversationEvent[] = [];
      const unsubscribe = await pubsub.subscribeWithReplay(
        sessionId,
        (e) => received.push(e),
        { replay: true }
      );

      expect(received.length).toBe(3);
      expect(received[0].data).toBe('msg1');
      expect(received[1].data).toBe('chunk1');
      expect(received[2].data).toBe('msg2');

      unsubscribe();
    });

    test('should replay from specific sequence', async () => {
      const sessionId = 'from-seq-test';

      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId, data: 'old1' });
      await pubsub.publishAndPersist({ ts: 200, type: 'message', sessionId, data: 'old2' });
      await pubsub.publishAndPersist({ ts: 300, type: 'message', sessionId, data: 'new1' });
      await pubsub.publishAndPersist({ ts: 400, type: 'message', sessionId, data: 'new2' });
      await pubsub.flush(sessionId);

      const received: ConversationEvent[] = [];
      const unsubscribe = await pubsub.subscribeWithReplay(
        sessionId,
        (e) => received.push(e),
        { replay: true, fromSeq: 3 }
      );

      expect(received.length).toBe(2);
      expect(received[0].data).toBe('new1');
      expect(received[1].data).toBe('new2');

      unsubscribe();
    });

    test('should receive live events after replay', async () => {
      const sessionId = 'live-after-replay';

      // Historical event
      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId, data: 'history' });
      await pubsub.flush(sessionId);

      const received: ConversationEvent[] = [];
      const unsubscribe = await pubsub.subscribeWithReplay(
        sessionId,
        (e) => received.push(e),
        { replay: true }
      );

      // Should have historical event
      expect(received.length).toBe(1);
      expect(received[0].data).toBe('history');

      // Publish live event
      await pubsub.publishAndPersist({ ts: 200, type: 'message', sessionId, data: 'live' });

      // Should receive live event
      expect(received.length).toBe(2);
      expect(received[1].data).toBe('live');

      unsubscribe();
    });

    test('should skip replay when disabled', async () => {
      const sessionId = 'no-replay';

      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId, data: 'history' });
      await pubsub.flush(sessionId);

      const received: ConversationEvent[] = [];
      const unsubscribe = await pubsub.subscribeWithReplay(
        sessionId,
        (e) => received.push(e),
        { replay: false }
      );

      // Should NOT have historical event
      expect(received.length).toBe(0);

      // But should receive live events
      await pubsub.publishAndPersist({ ts: 200, type: 'message', sessionId, data: 'live' });
      expect(received.length).toBe(1);

      unsubscribe();
    });
  });

  describe('multiple subscribers', () => {
    test('should deliver to all subscribers', async () => {
      const sessionId = 'multi-sub';
      const received1: ConversationEvent[] = [];
      const received2: ConversationEvent[] = [];

      const unsub1 = await pubsub.subscribeWithReplay(sessionId, (e) => received1.push(e), { replay: false });
      const unsub2 = await pubsub.subscribeWithReplay(sessionId, (e) => received2.push(e), { replay: false });

      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId, data: 'broadcast' });

      expect(received1.length).toBe(1);
      expect(received2.length).toBe(1);
      expect(received1[0].data).toBe('broadcast');
      expect(received2[0].data).toBe('broadcast');

      unsub1();
      unsub2();
    });

    test('should not affect other subscribers when one unsubscribes', async () => {
      const sessionId = 'unsub-test';
      const received1: ConversationEvent[] = [];
      const received2: ConversationEvent[] = [];

      const unsub1 = await pubsub.subscribeWithReplay(sessionId, (e) => received1.push(e), { replay: false });
      const unsub2 = await pubsub.subscribeWithReplay(sessionId, (e) => received2.push(e), { replay: false });

      // First message
      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId, data: 'first' });
      expect(received1.length).toBe(1);
      expect(received2.length).toBe(1);

      // Unsubscribe first
      unsub1();

      // Second message
      await pubsub.publishAndPersist({ ts: 200, type: 'message', sessionId, data: 'second' });
      expect(received1.length).toBe(1); // Still 1
      expect(received2.length).toBe(2); // Got second message

      unsub2();
    });
  });

  describe('session isolation', () => {
    test('should isolate events between sessions', async () => {
      const receivedA: ConversationEvent[] = [];
      const receivedB: ConversationEvent[] = [];

      await pubsub.subscribeWithReplay('session-A', (e) => receivedA.push(e), { replay: false });
      await pubsub.subscribeWithReplay('session-B', (e) => receivedB.push(e), { replay: false });

      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId: 'session-A', data: 'for A' });
      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId: 'session-B', data: 'for B' });

      expect(receivedA.length).toBe(1);
      expect(receivedB.length).toBe(1);
      expect(receivedA[0].data).toBe('for A');
      expect(receivedB[0].data).toBe('for B');
    });

    test('should maintain separate sequence counters', async () => {
      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId: 'A', data: 'A1' });
      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId: 'A', data: 'A2' });
      await pubsub.publishAndPersist({ ts: 100, type: 'message', sessionId: 'B', data: 'B1' });

      await pubsub.flush('A');
      await pubsub.flush('B');

      const eventsA = await pubsub.store.read('A');
      const eventsB = await pubsub.store.read('B');

      expect(eventsA[0].seq).toBe(1);
      expect(eventsA[1].seq).toBe(2);
      expect(eventsB[0].seq).toBe(1);
    });
  });

  describe('streaming conversation simulation', () => {
    test('should handle full conversation flow', async () => {
      const sessionId = 'conversation';
      const events: ConversationEvent[] = [];

      const unsub = await pubsub.subscribeWithReplay(sessionId, (e) => events.push(e), { replay: true });

      // User message
      await pubsub.publishAndPersist({
        ts: 1000,
        type: 'message',
        sessionId,
        data: { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'What is 2+2?' }] },
      });

      // Assistant streaming response
      await pubsub.publishAndPersist({
        ts: 2000,
        type: 'chunk',
        sessionId,
        data: { type: 'start', messageId: 'a1' },
      });

      await pubsub.publishAndPersist({
        ts: 2100,
        type: 'chunk',
        sessionId,
        data: { type: 'text-delta', id: 't1', delta: 'The answer' },
      });

      await pubsub.publishAndPersist({
        ts: 2200,
        type: 'chunk',
        sessionId,
        data: { type: 'text-delta', id: 't1', delta: ' is 4.' },
      });

      await pubsub.publishAndPersist({
        ts: 2300,
        type: 'chunk',
        sessionId,
        data: { type: 'finish' },
      });

      await pubsub.flush(sessionId);

      // Verify events
      expect(events.length).toBe(5);
      expect(events[0].type).toBe('message');
      expect(events[1].type).toBe('chunk');
      expect((events[1].data as any).type).toBe('start');
      expect((events[2].data as any).type).toBe('text-delta');
      expect((events[3].data as any).type).toBe('text-delta');
      expect((events[4].data as any).type).toBe('finish');

      unsub();

      // New subscriber should be able to replay
      const replayed: ConversationEvent[] = [];
      const unsub2 = await pubsub.subscribeWithReplay(sessionId, (e) => replayed.push(e), { replay: true });

      expect(replayed.length).toBe(5);
      expect(replayed.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);

      unsub2();
    });
  });
});

console.log('SessionPubSub integration tests loaded');
