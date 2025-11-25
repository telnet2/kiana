/**
 * ConversationStore - JSONL-based persistent storage for session events
 *
 * Stores conversation events in JSONL format for efficient append-only
 * writes and streaming reads. Supports history replay and snapshots.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createInterface } from 'readline';
import type {
  ConversationEvent,
  ConversationSnapshot,
  IConversationStore,
  ReadOptions,
  SessionMetadata,
  SnapshotEvent,
} from './types';

/**
 * JSONLConversationStore - File-based implementation of IConversationStore
 *
 * File structure:
 * - {basePath}/conversations/session-{id}.jsonl - Event log
 * - {basePath}/conversations/session-{id}.meta.json - Metadata cache
 * - {basePath}/snapshots/session-{id}.snapshot.json - Latest snapshot
 */
export class JSONLConversationStore implements IConversationStore {
  private basePath: string;
  private conversationsDir: string;
  private snapshotsDir: string;
  private writeStreams = new Map<string, fs.WriteStream>();
  private writeBuffers = new Map<string, ConversationEvent[]>();
  private metadataCache = new Map<string, SessionMetadata>();
  private flushInterval: NodeJS.Timeout | null = null;
  private debug: boolean;
  private bufferSize: number;
  private flushIntervalMs: number;

  constructor(basePath: string, options?: {
    debug?: boolean;
    bufferSize?: number;
    flushIntervalMs?: number;
  }) {
    this.basePath = basePath;
    this.conversationsDir = path.join(basePath, 'conversations');
    this.snapshotsDir = path.join(basePath, 'snapshots');
    this.debug = options?.debug ?? false;
    this.bufferSize = options?.bufferSize ?? 10;
    this.flushIntervalMs = options?.flushIntervalMs ?? 1000;

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Get the JSONL file path for a session
   */
  private getEventFilePath(sessionId: string): string {
    return path.join(this.conversationsDir, `session-${sessionId}.jsonl`);
  }

  /**
   * Get the metadata file path for a session
   */
  private getMetadataFilePath(sessionId: string): string {
    return path.join(this.conversationsDir, `session-${sessionId}.meta.json`);
  }

  /**
   * Get the snapshot file path for a session
   */
  private getSnapshotFilePath(sessionId: string): string {
    return path.join(this.snapshotsDir, `session-${sessionId}.snapshot.json`);
  }

  /**
   * Ensure directories exist
   */
  private async ensureDirs(): Promise<void> {
    await fs.promises.mkdir(this.conversationsDir, { recursive: true });
    await fs.promises.mkdir(this.snapshotsDir, { recursive: true });
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(async () => {
      for (const sessionId of this.writeBuffers.keys()) {
        await this.flushBuffer(sessionId);
      }
    }, this.flushIntervalMs);
  }

  /**
   * Flush buffered events to disk for a session
   */
  private async flushBuffer(sessionId: string): Promise<void> {
    const buffer = this.writeBuffers.get(sessionId);
    if (!buffer || buffer.length === 0) return;

    // Clear buffer before writing to avoid duplicates on retry
    this.writeBuffers.set(sessionId, []);

    await this.ensureDirs();

    const filePath = this.getEventFilePath(sessionId);
    let stream = this.writeStreams.get(sessionId);

    if (!stream) {
      stream = fs.createWriteStream(filePath, { flags: 'a' });
      this.writeStreams.set(sessionId, stream);
    }

    // Write all buffered events
    for (const event of buffer) {
      const line = JSON.stringify(event) + '\n';
      await new Promise<void>((resolve, reject) => {
        stream!.write(line, (err) => (err ? reject(err) : resolve()));
      });

      // Update metadata
      await this.updateMetadata(sessionId, event);
    }

    if (this.debug) {
      console.log(`[ConversationStore] Flushed ${buffer.length} events for session: ${sessionId}`);
    }
  }

  /**
   * Update cached metadata after writing an event
   */
  private async updateMetadata(sessionId: string, event: ConversationEvent): Promise<void> {
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

    if (event.type === 'message') {
      meta.messageCount++;
    }

    if (event.type === 'snapshot') {
      meta.lastSnapshotSeq = event.seq;
    }

    this.metadataCache.set(sessionId, meta);

    // Persist metadata periodically (every 10 events)
    if (meta.eventCount % 10 === 0) {
      await this.persistMetadata(sessionId, meta);
    }
  }

  /**
   * Persist metadata to disk
   */
  private async persistMetadata(sessionId: string, meta: SessionMetadata): Promise<void> {
    await this.ensureDirs();
    const metaPath = this.getMetadataFilePath(sessionId);
    await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2));
  }

  /**
   * Load metadata from disk
   */
  private async loadMetadata(sessionId: string): Promise<SessionMetadata | null> {
    // Check cache first
    const cached = this.metadataCache.get(sessionId);
    if (cached) return cached;

    const metaPath = this.getMetadataFilePath(sessionId);
    try {
      const content = await fs.promises.readFile(metaPath, 'utf8');
      const meta = JSON.parse(content) as SessionMetadata;
      this.metadataCache.set(sessionId, meta);
      return meta;
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn(`[ConversationStore] Failed to load metadata for ${sessionId}:`, err);
      }
      return null;
    }
  }

  /**
   * Append an event to the session log
   */
  async append(event: ConversationEvent): Promise<void> {
    const sessionId = event.sessionId;

    // Add to buffer
    let buffer = this.writeBuffers.get(sessionId);
    if (!buffer) {
      buffer = [];
      this.writeBuffers.set(sessionId, buffer);
    }
    buffer.push(event);

    // Flush if buffer is full
    if (buffer.length >= this.bufferSize) {
      await this.flushBuffer(sessionId);
    }
  }

  /**
   * Read events from a session with filtering options
   */
  async read(sessionId: string, options?: ReadOptions): Promise<ConversationEvent[]> {
    const events: ConversationEvent[] = [];
    const filePath = this.getEventFilePath(sessionId);

    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch {
      // Also check buffer for unflushed events
      const buffer = this.writeBuffers.get(sessionId) || [];
      return this.filterEvents(buffer, options);
    }

    // Read from file
    const fileStream = fs.createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as ConversationEvent;
          events.push(event);
        } catch (parseErr) {
          console.warn(`[ConversationStore] Failed to parse line in ${sessionId}:`, parseErr);
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }

    // Add unflushed buffered events
    const buffer = this.writeBuffers.get(sessionId) || [];
    events.push(...buffer);

    // Apply filters
    return this.filterEvents(events, options);
  }

  /**
   * Filter events based on options
   */
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

  /**
   * Stream events from a session (async generator)
   */
  async *stream(sessionId: string, fromSeq = 0): AsyncIterable<ConversationEvent> {
    const filePath = this.getEventFilePath(sessionId);

    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch {
      // Yield buffered events only
      const buffer = this.writeBuffers.get(sessionId) || [];
      for (const event of buffer) {
        if (event.seq >= fromSeq) {
          yield event;
        }
      }
      return;
    }

    // Stream from file
    const fileStream = fs.createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as ConversationEvent;
          if (event.seq >= fromSeq) {
            yield event;
          }
        } catch (parseErr) {
          console.warn(`[ConversationStore] Failed to parse line in ${sessionId}:`, parseErr);
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }

    // Yield buffered events
    const buffer = this.writeBuffers.get(sessionId) || [];
    for (const event of buffer) {
      if (event.seq >= fromSeq) {
        yield event;
      }
    }
  }

  /**
   * Get session metadata
   */
  async getMetadata(sessionId: string): Promise<SessionMetadata | null> {
    // Try cache first
    let meta = await this.loadMetadata(sessionId);

    if (!meta) {
      // Compute from events if no cached metadata
      const events = await this.read(sessionId);
      if (events.length === 0) return null;

      meta = {
        sessionId,
        createdAt: events[0].ts,
        lastEventAt: events[events.length - 1].ts,
        eventCount: events.length,
        byteSize: events.reduce((sum, e) => sum + Buffer.byteLength(JSON.stringify(e) + '\n'), 0),
        messageCount: events.filter((e) => e.type === 'message').length,
      };

      // Find last snapshot
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === 'snapshot') {
          meta.lastSnapshotSeq = events[i].seq;
          break;
        }
      }

      this.metadataCache.set(sessionId, meta);
    }

    return meta;
  }

  /**
   * Save a snapshot for faster replay
   */
  async saveSnapshot(sessionId: string, snapshot: ConversationSnapshot): Promise<void> {
    await this.ensureDirs();

    // Save snapshot as a regular event
    const snapshotEvent: Omit<SnapshotEvent, 'seq'> = {
      ts: Date.now(),
      type: 'snapshot',
      sessionId,
      data: snapshot,
    };

    // Also save to dedicated snapshot file for fast access
    const snapshotPath = this.getSnapshotFilePath(sessionId);
    await fs.promises.writeFile(snapshotPath, JSON.stringify({
      ...snapshotEvent,
      seq: snapshot.atSeq,
    }, null, 2));

    if (this.debug) {
      console.log(`[ConversationStore] Saved snapshot for session: ${sessionId} at seq: ${snapshot.atSeq}`);
    }
  }

  /**
   * Get the latest snapshot for a session
   */
  async getLatestSnapshot(sessionId: string): Promise<SnapshotEvent | null> {
    const snapshotPath = this.getSnapshotFilePath(sessionId);

    try {
      const content = await fs.promises.readFile(snapshotPath, 'utf8');
      return JSON.parse(content) as SnapshotEvent;
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn(`[ConversationStore] Failed to load snapshot for ${sessionId}:`, err);
      }
      return null;
    }
  }

  /**
   * Check if a session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    const filePath = this.getEventFilePath(sessionId);
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      // Check if there are buffered events
      const buffer = this.writeBuffers.get(sessionId);
      return buffer !== undefined && buffer.length > 0;
    }
  }

  /**
   * Delete all data for a session
   */
  async delete(sessionId: string): Promise<void> {
    // Close write stream
    const stream = this.writeStreams.get(sessionId);
    if (stream) {
      await new Promise<void>((resolve) => stream.end(resolve));
      this.writeStreams.delete(sessionId);
    }

    // Clear buffer
    this.writeBuffers.delete(sessionId);

    // Clear metadata cache
    this.metadataCache.delete(sessionId);

    // Delete files
    const filesToDelete = [
      this.getEventFilePath(sessionId),
      this.getMetadataFilePath(sessionId),
      this.getSnapshotFilePath(sessionId),
    ];

    for (const filePath of filesToDelete) {
      try {
        await fs.promises.unlink(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.warn(`[ConversationStore] Failed to delete ${filePath}:`, err);
        }
      }
    }

    if (this.debug) {
      console.log(`[ConversationStore] Deleted session: ${sessionId}`);
    }
  }

  /**
   * Flush buffered writes for a session
   */
  async flush(sessionId: string): Promise<void> {
    await this.flushBuffer(sessionId);

    // Ensure metadata is persisted
    const meta = this.metadataCache.get(sessionId);
    if (meta) {
      await this.persistMetadata(sessionId, meta);
    }
  }

  /**
   * Flush all sessions and close the store
   */
  async close(): Promise<void> {
    // Stop periodic flush
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush all buffers
    for (const sessionId of this.writeBuffers.keys()) {
      await this.flushBuffer(sessionId);
    }

    // Close all write streams
    for (const [sessionId, stream] of this.writeStreams) {
      await new Promise<void>((resolve) => stream.end(resolve));
    }
    this.writeStreams.clear();

    // Persist all metadata
    for (const [sessionId, meta] of this.metadataCache) {
      await this.persistMetadata(sessionId, meta);
    }

    if (this.debug) {
      console.log(`[ConversationStore] Closed`);
    }
  }

  /**
   * Get list of all session IDs with stored events
   */
  async listSessions(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.conversationsDir);
      const sessionIds = files
        .filter((f) => f.startsWith('session-') && f.endsWith('.jsonl'))
        .map((f) => f.replace('session-', '').replace('.jsonl', ''));

      // Add sessions with only buffered events
      for (const sessionId of this.writeBuffers.keys()) {
        if (!sessionIds.includes(sessionId)) {
          sessionIds.push(sessionId);
        }
      }

      return sessionIds;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return Array.from(this.writeBuffers.keys());
      }
      throw err;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    sessionCount: number;
    totalEvents: number;
    totalBytes: number;
    bufferedEvents: number;
  }> {
    const sessions = await this.listSessions();
    let totalEvents = 0;
    let totalBytes = 0;
    let bufferedEvents = 0;

    for (const sessionId of sessions) {
      const meta = await this.getMetadata(sessionId);
      if (meta) {
        totalEvents += meta.eventCount;
        totalBytes += meta.byteSize;
      }
      bufferedEvents += this.writeBuffers.get(sessionId)?.length || 0;
    }

    return {
      sessionCount: sessions.length,
      totalEvents,
      totalBytes,
      bufferedEvents,
    };
  }
}

/**
 * Factory function to create a ConversationStore
 */
export function createConversationStore(
  basePath: string,
  options?: {
    debug?: boolean;
    bufferSize?: number;
    flushIntervalMs?: number;
  }
): JSONLConversationStore {
  return new JSONLConversationStore(basePath, options);
}
