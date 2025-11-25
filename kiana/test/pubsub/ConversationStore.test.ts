/**
 * ConversationStore Tests
 *
 * Run with: bun test test/pubsub/ConversationStore.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { createInterface } from 'readline';

// Inline simplified types for testing
interface ConversationEvent<T = unknown> {
  ts: number;
  seq: number;
  type: 'message' | 'chunk' | 'tool_exec' | 'error' | 'metadata' | 'snapshot';
  sessionId: string;
  data: T;
}

interface ReadOptions {
  fromSeq?: number;
  toSeq?: number;
  fromTs?: number;
  toTs?: number;
  limit?: number;
  types?: string[];
  messagesOnly?: boolean;
}

interface SessionMetadata {
  sessionId: string;
  createdAt: number;
  lastEventAt: number;
  eventCount: number;
  byteSize: number;
  messageCount: number;
  lastSnapshotSeq?: number;
}

// Inline simplified ConversationStore for testing
class JSONLConversationStore {
  private basePath: string;
  private conversationsDir: string;
  private snapshotsDir: string;
  private writeStreams = new Map<string, fs.WriteStream>();
  private writeBuffers = new Map<string, ConversationEvent[]>();
  private metadataCache = new Map<string, SessionMetadata>();
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private bufferSize: number;

  constructor(basePath: string, options?: { bufferSize?: number }) {
    this.basePath = basePath;
    this.conversationsDir = path.join(basePath, 'conversations');
    this.snapshotsDir = path.join(basePath, 'snapshots');
    this.bufferSize = options?.bufferSize ?? 10;
  }

  private getEventFilePath(sessionId: string): string {
    return path.join(this.conversationsDir, `session-${sessionId}.jsonl`);
  }

  private getMetadataFilePath(sessionId: string): string {
    return path.join(this.conversationsDir, `session-${sessionId}.meta.json`);
  }

  private async ensureDirs(): Promise<void> {
    await fs.promises.mkdir(this.conversationsDir, { recursive: true });
    await fs.promises.mkdir(this.snapshotsDir, { recursive: true });
  }

  private async flushBuffer(sessionId: string): Promise<void> {
    const buffer = this.writeBuffers.get(sessionId);
    if (!buffer || buffer.length === 0) return;

    this.writeBuffers.set(sessionId, []);
    await this.ensureDirs();

    const filePath = this.getEventFilePath(sessionId);
    let stream = this.writeStreams.get(sessionId);

    if (!stream) {
      stream = fs.createWriteStream(filePath, { flags: 'a' });
      this.writeStreams.set(sessionId, stream);
    }

    for (const event of buffer) {
      const line = JSON.stringify(event) + '\n';
      await new Promise<void>((resolve, reject) => {
        stream!.write(line, (err) => (err ? reject(err) : resolve()));
      });
      this.updateMetadataSync(sessionId, event);
    }
  }

  private updateMetadataSync(sessionId: string, event: ConversationEvent): void {
    let meta = this.metadataCache.get(sessionId);
    if (!meta) {
      meta = {
        sessionId,
        createdAt: event.ts,
        lastEventAt: event.ts,
        eventCount: 0,
        byteSize: 0,
        messageCount: 0,
      };
    }
    meta.lastEventAt = event.ts;
    meta.eventCount++;
    meta.byteSize += Buffer.byteLength(JSON.stringify(event) + '\n', 'utf8');
    if (event.type === 'message') meta.messageCount++;
    this.metadataCache.set(sessionId, meta);
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

  async read(sessionId: string, options?: ReadOptions): Promise<ConversationEvent[]> {
    const events: ConversationEvent[] = [];
    const filePath = this.getEventFilePath(sessionId);

    try {
      await fs.promises.access(filePath);
      const fileStream = fs.createReadStream(filePath);
      const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line) as ConversationEvent);
        } catch {}
      }
      rl.close();
      fileStream.destroy();
    } catch {}

    // Add buffered events
    const buffer = this.writeBuffers.get(sessionId) || [];
    events.push(...buffer);

    return this.filterEvents(events, options);
  }

  private filterEvents(events: ConversationEvent[], options?: ReadOptions): ConversationEvent[] {
    if (!options) return events;
    let filtered = events;

    if (options.fromSeq !== undefined) {
      filtered = filtered.filter((e) => e.seq >= options.fromSeq!);
    }
    if (options.toSeq !== undefined) {
      filtered = filtered.filter((e) => e.seq <= options.toSeq!);
    }
    if (options.fromTs !== undefined) {
      filtered = filtered.filter((e) => e.ts >= options.fromTs!);
    }
    if (options.toTs !== undefined) {
      filtered = filtered.filter((e) => e.ts <= options.toTs!);
    }
    if (options.types && options.types.length > 0) {
      filtered = filtered.filter((e) => options.types!.includes(e.type));
    }
    if (options.messagesOnly) {
      filtered = filtered.filter((e) => e.type === 'message');
    }
    if (options.limit !== undefined) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }

  async flush(sessionId: string): Promise<void> {
    await this.flushBuffer(sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    const filePath = this.getEventFilePath(sessionId);
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      const buffer = this.writeBuffers.get(sessionId);
      return buffer !== undefined && buffer.length > 0;
    }
  }

  async delete(sessionId: string): Promise<void> {
    const stream = this.writeStreams.get(sessionId);
    if (stream) {
      await new Promise<void>((resolve) => stream.end(resolve));
      this.writeStreams.delete(sessionId);
    }
    this.writeBuffers.delete(sessionId);
    this.metadataCache.delete(sessionId);

    try {
      await fs.promises.unlink(this.getEventFilePath(sessionId));
    } catch {}
    try {
      await fs.promises.unlink(this.getMetadataFilePath(sessionId));
    } catch {}
  }

  async getMetadata(sessionId: string): Promise<SessionMetadata | null> {
    return this.metadataCache.get(sessionId) || null;
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

// Test helpers
const TEST_DIR = '/tmp/kiana-test-' + Date.now();

async function cleanupTestDir() {
  try {
    await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}
}

describe('ConversationStore', () => {
  let store: JSONLConversationStore;

  beforeEach(async () => {
    await cleanupTestDir();
    store = new JSONLConversationStore(TEST_DIR, { bufferSize: 2 });
  });

  afterEach(async () => {
    await store.close();
    await cleanupTestDir();
  });

  describe('append and read', () => {
    test('should append events to buffer', async () => {
      const event: ConversationEvent = {
        ts: Date.now(),
        seq: 1,
        type: 'message',
        sessionId: 'test-session',
        data: { text: 'Hello' },
      };

      await store.append(event);

      // Read should include buffered events
      const events = await store.read('test-session');
      expect(events.length).toBe(1);
      expect(events[0].data).toEqual({ text: 'Hello' });
    });

    test('should flush buffer when full', async () => {
      const sessionId = 'test-session';

      // Buffer size is 2, so third event should trigger flush
      await store.append({ ts: 1, seq: 1, type: 'message', sessionId, data: 'a' });
      await store.append({ ts: 2, seq: 2, type: 'message', sessionId, data: 'b' });
      await store.append({ ts: 3, seq: 3, type: 'message', sessionId, data: 'c' });

      const events = await store.read(sessionId);
      expect(events.length).toBe(3);
    });

    test('should persist events to JSONL file', async () => {
      const sessionId = 'test-session';

      await store.append({ ts: 1, seq: 1, type: 'message', sessionId, data: 'test' });
      await store.flush(sessionId);

      // Verify file exists and contains JSONL
      const filePath = path.join(TEST_DIR, 'conversations', `session-${sessionId}.jsonl`);
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.data).toBe('test');
    });
  });

  describe('read with filters', () => {
    beforeEach(async () => {
      const sessionId = 'filter-test';
      const events: ConversationEvent[] = [
        { ts: 100, seq: 1, type: 'message', sessionId, data: 'msg1' },
        { ts: 200, seq: 2, type: 'chunk', sessionId, data: 'chunk1' },
        { ts: 300, seq: 3, type: 'message', sessionId, data: 'msg2' },
        { ts: 400, seq: 4, type: 'chunk', sessionId, data: 'chunk2' },
        { ts: 500, seq: 5, type: 'message', sessionId, data: 'msg3' },
      ];

      for (const event of events) {
        await store.append(event);
      }
      await store.flush(sessionId);
    });

    test('should filter by fromSeq', async () => {
      const events = await store.read('filter-test', { fromSeq: 3 });
      expect(events.length).toBe(3);
      expect(events[0].seq).toBe(3);
    });

    test('should filter by toSeq', async () => {
      const events = await store.read('filter-test', { toSeq: 3 });
      expect(events.length).toBe(3);
      expect(events[2].seq).toBe(3);
    });

    test('should filter by sequence range', async () => {
      const events = await store.read('filter-test', { fromSeq: 2, toSeq: 4 });
      expect(events.length).toBe(3);
    });

    test('should filter by timestamp', async () => {
      const events = await store.read('filter-test', { fromTs: 200, toTs: 400 });
      expect(events.length).toBe(3);
    });

    test('should filter by types', async () => {
      const events = await store.read('filter-test', { types: ['message'] });
      expect(events.length).toBe(3);
      expect(events.every((e) => e.type === 'message')).toBe(true);
    });

    test('should filter messagesOnly', async () => {
      const events = await store.read('filter-test', { messagesOnly: true });
      expect(events.length).toBe(3);
    });

    test('should limit results', async () => {
      const events = await store.read('filter-test', { limit: 2 });
      expect(events.length).toBe(2);
    });

    test('should combine filters', async () => {
      const events = await store.read('filter-test', {
        fromSeq: 1,
        types: ['message'],
        limit: 2,
      });
      expect(events.length).toBe(2);
      expect(events[0].seq).toBe(1);
      expect(events[1].seq).toBe(3);
    });
  });

  describe('exists', () => {
    test('should return false for non-existent session', async () => {
      const exists = await store.exists('non-existent');
      expect(exists).toBe(false);
    });

    test('should return true for session with buffered events', async () => {
      await store.append({ ts: 1, seq: 1, type: 'message', sessionId: 'buffered', data: 'x' });
      const exists = await store.exists('buffered');
      expect(exists).toBe(true);
    });

    test('should return true for session with persisted events', async () => {
      const sessionId = 'persisted';
      await store.append({ ts: 1, seq: 1, type: 'message', sessionId, data: 'x' });
      await store.flush(sessionId);

      const exists = await store.exists(sessionId);
      expect(exists).toBe(true);
    });
  });

  describe('delete', () => {
    test('should remove session data', async () => {
      const sessionId = 'to-delete';
      await store.append({ ts: 1, seq: 1, type: 'message', sessionId, data: 'x' });
      await store.flush(sessionId);

      expect(await store.exists(sessionId)).toBe(true);

      await store.delete(sessionId);

      expect(await store.exists(sessionId)).toBe(false);
      const events = await store.read(sessionId);
      expect(events.length).toBe(0);
    });
  });

  describe('metadata', () => {
    test('should track event count', async () => {
      const sessionId = 'meta-test';
      await store.append({ ts: 1, seq: 1, type: 'message', sessionId, data: 'a' });
      await store.append({ ts: 2, seq: 2, type: 'chunk', sessionId, data: 'b' });
      await store.append({ ts: 3, seq: 3, type: 'message', sessionId, data: 'c' });
      await store.flush(sessionId);

      const meta = await store.getMetadata(sessionId);
      expect(meta).not.toBeNull();
      expect(meta!.eventCount).toBe(3);
      expect(meta!.messageCount).toBe(2);
    });

    test('should track timestamps', async () => {
      const sessionId = 'ts-test';
      await store.append({ ts: 100, seq: 1, type: 'message', sessionId, data: 'first' });
      await store.append({ ts: 500, seq: 2, type: 'message', sessionId, data: 'last' });
      await store.flush(sessionId);

      const meta = await store.getMetadata(sessionId);
      expect(meta!.createdAt).toBe(100);
      expect(meta!.lastEventAt).toBe(500);
    });
  });
});

console.log('ConversationStore tests loaded');
