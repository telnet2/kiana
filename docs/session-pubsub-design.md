# Kiana Session Pub-Sub Design Document

## Executive Summary

This document analyzes the cost and architecture for:
1. Storing session conversations in JSONL format
2. Implementing pub-sub for multiple clients to monitor conversations
3. Supporting history replay for new clients

## 1. Current State Analysis

### 1.1 Session Data Structure

Currently, sessions store minimal metadata in `/sessions/session-{id}.json`:

```typescript
interface SessionData {
  id: string;
  createdAt: string;
  name: string;
  workingDir: string;
  history: Array<{
    command: string;    // Shell command executed
    output: string;     // Command output
    timestamp: string;
  }>;
}
```

**Key Observation**: The current `history` only tracks shell commands, NOT the full conversation (user messages, assistant responses, tool calls, streaming events).

### 1.2 AI SDK v6 Stream Events

From the AI SDK v6, the `UIMessageChunk` types represent all possible stream events:

| Event Type | Description | Storage Size (approx) |
|------------|-------------|----------------------|
| `start` | Message start | ~100 bytes |
| `text-start` | Text part begins | ~50 bytes |
| `text-delta` | Text chunk | ~50-500 bytes per delta |
| `text-end` | Text part ends | ~50 bytes |
| `tool-input-start` | Tool call begins | ~100 bytes |
| `tool-input-delta` | Tool input streaming | ~50-200 bytes |
| `tool-input-available` | Full tool input | ~200-2KB (depends on args) |
| `tool-output-available` | Tool result | ~200-50KB (depends on output) |
| `tool-output-error` | Tool error | ~200-1KB |
| `reasoning-start/delta/end` | Reasoning (if model supports) | ~50-500 bytes |
| `finish` | Message complete | ~100 bytes |

### 1.3 Conversation Message Structure

From AI SDK v6's `UIMessage`:

```typescript
interface UIMessage {
  id: string;                    // ~26 bytes (ULID)
  role: 'system' | 'user' | 'assistant';
  metadata?: unknown;
  parts: Array<UIMessagePart>;   // Variable size
}

type UIMessagePart =
  | TextUIPart          // { type: 'text', text: string }
  | ReasoningUIPart     // { type: 'reasoning', text: string }
  | ToolUIPart          // { type: 'tool-*', toolCallId, input, output }
  | DynamicToolUIPart   // { type: 'dynamic-tool', ... }
  | FileUIPart          // { type: 'file', url, mediaType }
  | DataUIPart          // { type: 'data-*', data }
  | ...
```

## 2. JSONL Storage Cost Analysis

### 2.1 Proposed JSONL Schema

Each line in the JSONL file represents one event:

```jsonl
{"ts":1732521600000,"seq":1,"type":"message","data":{"id":"msg-1","role":"user","parts":[{"type":"text","text":"Hello"}]}}
{"ts":1732521600100,"seq":2,"type":"chunk","data":{"type":"start","messageId":"msg-2"}}
{"ts":1732521600150,"seq":3,"type":"chunk","data":{"type":"text-delta","id":"t1","delta":"Hi"}}
{"ts":1732521600200,"seq":4,"type":"chunk","data":{"type":"text-delta","id":"t1","delta":" there!"}}
{"ts":1732521600250,"seq":5,"type":"chunk","data":{"type":"finish","finishReason":"stop"}}
{"ts":1732521600300,"seq":6,"type":"message","data":{"id":"msg-2","role":"assistant","parts":[{"type":"text","text":"Hi there!"}]}}
```

### 2.2 Event Wrapper Schema

```typescript
interface ConversationEvent {
  ts: number;           // Unix timestamp (milliseconds)
  seq: number;          // Sequence number for ordering
  type: 'message' | 'chunk' | 'tool_exec' | 'error' | 'metadata';
  sessionId: string;    // Session identifier
  data: UIMessage | UIMessageChunk | ToolExecution | Error | Record<string, unknown>;
}
```

### 2.3 Storage Cost Estimates

#### Per-Event Overhead
- Timestamp: 13 bytes
- Sequence: 1-10 bytes
- Type field: 10-20 bytes
- JSON syntax: ~30 bytes
- **Total overhead per event: ~60-70 bytes**

#### Typical Conversation Estimates

| Scenario | Events | Avg Event Size | Total Size |
|----------|--------|----------------|------------|
| Simple Q&A (1 turn) | ~10 | 150 bytes | ~1.5 KB |
| Multi-turn chat (10 turns) | ~100 | 200 bytes | ~20 KB |
| Tool-heavy session (20 tool calls) | ~200 | 500 bytes | ~100 KB |
| Long coding session (50 turns, many tools) | ~1000 | 400 bytes | ~400 KB |
| Heavy session (100 turns, large outputs) | ~3000 | 600 bytes | ~1.8 MB |

#### Monthly Storage Estimates

| Usage Pattern | Sessions/Day | Size/Session | Daily | Monthly |
|--------------|--------------|--------------|-------|---------|
| Light (testing) | 10 | 50 KB | 500 KB | 15 MB |
| Moderate (dev team) | 100 | 100 KB | 10 MB | 300 MB |
| Heavy (production) | 1000 | 200 KB | 200 MB | 6 GB |
| Enterprise | 10000 | 300 KB | 3 GB | 90 GB |

### 2.4 Storage Optimization Strategies

1. **Compression**: GZIP typically achieves 70-90% compression on JSON text
   - 100 KB session → ~15 KB compressed

2. **Delta Storage**: Only store text deltas, reconstruct full messages client-side

3. **TTL/Archival**: Archive old sessions to cold storage after N days

4. **Selective Storage**: Option to skip transient events (text-delta) and only store final messages

## 3. Pub-Sub Architecture Design

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Kiana Server                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐ │
│  │  Chat API       │───▶│ SessionEventBus  │───▶│ JSONL Writer   │ │
│  │  /api/chat      │    │                  │    │ (persistent)   │ │
│  └─────────────────┘    │  EventEmitter    │    └────────────────┘ │
│                         │  per session     │                        │
│                         └────────┬─────────┘                        │
│                                  │                                   │
│                    ┌─────────────┼─────────────┐                    │
│                    │             │             │                     │
│              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐             │
│              │SSE Client │ │SSE Client │ │SSE Client │             │
│              │  (Web 1)  │ │  (Web 2)  │ │  (CLI)    │             │
│              └───────────┘ └───────────┘ └───────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Components

#### 3.2.1 SessionEventBus

```typescript
import { EventEmitter } from 'eventemitter3';

interface SessionEventBus {
  // Subscribe to session events
  subscribe(sessionId: string, callback: (event: ConversationEvent) => void): () => void;

  // Publish event to all subscribers
  publish(sessionId: string, event: ConversationEvent): void;

  // Get subscriber count for a session
  getSubscriberCount(sessionId: string): number;

  // Cleanup session resources
  cleanup(sessionId: string): void;
}

class SessionEventBusImpl implements SessionEventBus {
  private emitters = new Map<string, EventEmitter>();
  private sequences = new Map<string, number>();

  subscribe(sessionId: string, callback: (event: ConversationEvent) => void): () => void {
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
        this.sequences.delete(sessionId);
      }
    };
  }

  publish(sessionId: string, event: ConversationEvent): void {
    const emitter = this.emitters.get(sessionId);
    if (emitter) {
      // Assign sequence number
      const seq = (this.sequences.get(sessionId) || 0) + 1;
      this.sequences.set(sessionId, seq);
      event.seq = seq;

      emitter.emit('event', event);
    }
  }

  getSubscriberCount(sessionId: string): number {
    return this.emitters.get(sessionId)?.listenerCount('event') || 0;
  }

  cleanup(sessionId: string): void {
    const emitter = this.emitters.get(sessionId);
    if (emitter) {
      emitter.removeAllListeners();
      this.emitters.delete(sessionId);
      this.sequences.delete(sessionId);
    }
  }
}
```

#### 3.2.2 ConversationStore (JSONL Writer)

```typescript
interface ConversationStore {
  // Append event to session log
  append(sessionId: string, event: ConversationEvent): Promise<void>;

  // Read events from session (for replay)
  read(sessionId: string, options?: ReadOptions): Promise<ConversationEvent[]>;

  // Stream events from a specific sequence
  stream(sessionId: string, fromSeq?: number): AsyncIterable<ConversationEvent>;

  // Get session metadata
  getMetadata(sessionId: string): Promise<SessionMetadata | null>;
}

interface ReadOptions {
  fromSeq?: number;      // Start from sequence number
  toSeq?: number;        // End at sequence number
  fromTs?: number;       // Start from timestamp
  toTs?: number;         // End at timestamp
  limit?: number;        // Max events to return
  types?: string[];      // Filter by event types
}

interface SessionMetadata {
  sessionId: string;
  createdAt: number;
  lastEventAt: number;
  eventCount: number;
  byteSize: number;
}
```

#### 3.2.3 JSONL File Implementation

```typescript
import { createWriteStream, createReadStream } from 'fs';
import { createInterface } from 'readline';

class JSONLConversationStore implements ConversationStore {
  private basePath: string;
  private writeStreams = new Map<string, fs.WriteStream>();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private getFilePath(sessionId: string): string {
    return path.join(this.basePath, `session-${sessionId}.jsonl`);
  }

  async append(sessionId: string, event: ConversationEvent): Promise<void> {
    let stream = this.writeStreams.get(sessionId);
    if (!stream) {
      const filePath = this.getFilePath(sessionId);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      stream = createWriteStream(filePath, { flags: 'a' });
      this.writeStreams.set(sessionId, stream);
    }

    const line = JSON.stringify(event) + '\n';
    return new Promise((resolve, reject) => {
      stream!.write(line, (err) => err ? reject(err) : resolve());
    });
  }

  async read(sessionId: string, options?: ReadOptions): Promise<ConversationEvent[]> {
    const events: ConversationEvent[] = [];
    const filePath = this.getFilePath(sessionId);

    if (!await fs.access(filePath).then(() => true).catch(() => false)) {
      return events;
    }

    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      const event = JSON.parse(line) as ConversationEvent;

      // Apply filters
      if (options?.fromSeq && event.seq < options.fromSeq) continue;
      if (options?.toSeq && event.seq > options.toSeq) continue;
      if (options?.fromTs && event.ts < options.fromTs) continue;
      if (options?.toTs && event.ts > options.toTs) continue;
      if (options?.types && !options.types.includes(event.type)) continue;

      events.push(event);

      if (options?.limit && events.length >= options.limit) break;
    }

    return events;
  }

  async *stream(sessionId: string, fromSeq = 0): AsyncIterable<ConversationEvent> {
    const filePath = this.getFilePath(sessionId);

    if (!await fs.access(filePath).then(() => true).catch(() => false)) {
      return;
    }

    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ConversationEvent;
      if (event.seq >= fromSeq) {
        yield event;
      }
    }
  }
}
```

### 3.3 API Endpoints

#### 3.3.1 Subscribe to Session Events (SSE)

```typescript
// GET /api/sessions/:sessionId/events
// Query params: ?fromSeq=0&replay=true

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;
  const fromSeq = parseInt(req.nextUrl.searchParams.get('fromSeq') || '0');
  const replay = req.nextUrl.searchParams.get('replay') === 'true';

  const eventBus = getSessionEventBus();
  const store = getConversationStore();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: {"sessionId":"${sessionId}"}\n\n`));

      // Replay history if requested
      if (replay && fromSeq >= 0) {
        const history = await store.read(sessionId, { fromSeq });
        for (const event of history) {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        }
        controller.enqueue(encoder.encode(`event: replay-complete\ndata: {"lastSeq":${history[history.length - 1]?.seq || 0}}\n\n`));
      }

      // Subscribe to live events
      const unsubscribe = eventBus.subscribe(sessionId, (event) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
      });

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### 3.3.2 Get Session History

```typescript
// GET /api/sessions/:sessionId/history
// Query params: ?fromSeq=0&limit=100&types=message,chunk

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const store = getConversationStore();
  const searchParams = req.nextUrl.searchParams;

  const events = await store.read(params.sessionId, {
    fromSeq: parseInt(searchParams.get('fromSeq') || '0'),
    limit: parseInt(searchParams.get('limit') || '1000'),
    types: searchParams.get('types')?.split(','),
  });

  return Response.json({ events, count: events.length });
}
```

### 3.4 Integration with Chat API

Modify `/api/chat/route.ts` to publish events:

```typescript
export async function POST(req: NextRequest) {
  const store = getSessionStore();
  const eventBus = getSessionEventBus();
  const convStore = getConversationStore();

  // ... existing code ...

  const agent = await createKianaAgent(rec.shell, { /* ... */ });

  // Wrap the stream to capture and publish events
  const originalStream = await createAgentUIStream({ agent, messages: inputMessages });

  const teeStream = new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      // Create conversation event
      const event: ConversationEvent = {
        ts: Date.now(),
        seq: 0, // Will be assigned by eventBus
        type: 'chunk',
        sessionId: effectiveSessionId,
        data: chunk,
      };

      // Publish to subscribers and persist
      eventBus.publish(effectiveSessionId, event);
      convStore.append(effectiveSessionId, event).catch(console.error);

      // Pass through to original response
      controller.enqueue(chunk);
    },
  });

  return createAgentUIStreamResponse({
    agent,
    messages: inputMessages,
    // Use transform to intercept stream
  });
}
```

## 4. History Replay Design

### 4.1 Replay Modes

1. **Full Replay**: Replay all events from the beginning
2. **Partial Replay**: Replay from a specific sequence number
3. **Message-Only Replay**: Only replay completed messages (skip deltas)
4. **Time-Based Replay**: Replay events from a specific timestamp

### 4.2 Client-Side State Reconstruction

```typescript
interface ConversationState {
  messages: UIMessage[];
  currentAssistantMessage: UIMessage | null;
  pendingToolCalls: Map<string, ToolUIPart>;
  lastSeq: number;
}

function reconstructState(events: ConversationEvent[]): ConversationState {
  const state: ConversationState = {
    messages: [],
    currentAssistantMessage: null,
    pendingToolCalls: new Map(),
    lastSeq: 0,
  };

  for (const event of events) {
    state.lastSeq = Math.max(state.lastSeq, event.seq);

    if (event.type === 'message') {
      const msg = event.data as UIMessage;
      state.messages.push(msg);
      if (msg.role === 'assistant') {
        state.currentAssistantMessage = null; // Finalized
      }
    } else if (event.type === 'chunk') {
      const chunk = event.data as UIMessageChunk;
      applyChunkToState(state, chunk);
    }
  }

  return state;
}

function applyChunkToState(state: ConversationState, chunk: UIMessageChunk) {
  switch (chunk.type) {
    case 'start':
      state.currentAssistantMessage = {
        id: chunk.messageId || `msg-${Date.now()}`,
        role: 'assistant',
        parts: [],
        metadata: chunk.messageMetadata,
      };
      break;

    case 'text-delta':
      if (state.currentAssistantMessage) {
        let textPart = state.currentAssistantMessage.parts.find(
          p => p.type === 'text' && p.id === chunk.id
        ) as TextUIPart | undefined;

        if (!textPart) {
          textPart = { type: 'text', text: '', id: chunk.id, state: 'streaming' };
          state.currentAssistantMessage.parts.push(textPart);
        }
        textPart.text += chunk.delta;
      }
      break;

    case 'tool-input-available':
      // ... handle tool calls
      break;

    case 'tool-output-available':
      // ... handle tool results
      break;

    case 'finish':
      if (state.currentAssistantMessage) {
        state.messages.push(state.currentAssistantMessage);
        state.currentAssistantMessage = null;
      }
      break;
  }
}
```

### 4.3 Optimized Replay for New Clients

For new clients joining a long-running session:

1. **Snapshot Strategy**: Periodically save full state snapshots
2. **Checkpoint Events**: Insert checkpoint events in JSONL for faster seeking
3. **Materialized Messages**: Store final `message` events after each `finish`

```typescript
// Optimized replay: use snapshots + recent events
async function replayForNewClient(sessionId: string): Promise<ConversationState> {
  const store = getConversationStore();

  // Find latest snapshot
  const snapshot = await store.getLatestSnapshot(sessionId);

  if (snapshot) {
    // Replay only events after snapshot
    const events = await store.read(sessionId, { fromSeq: snapshot.seq + 1 });
    return applyEventsToState(snapshot.state, events);
  }

  // No snapshot, full replay
  const events = await store.read(sessionId);
  return reconstructState(events);
}
```

## 5. Implementation Plan

### Phase 1: Core Infrastructure (Estimated: 3-5 days)

1. Create `ConversationEvent` type definitions
2. Implement `SessionEventBus` with EventEmitter
3. Implement `JSONLConversationStore`
4. Add event publishing to existing chat API

### Phase 2: API Endpoints (Estimated: 2-3 days)

1. Create SSE endpoint for event subscription
2. Create history retrieval endpoint
3. Add replay support with filtering options

### Phase 3: Client Integration (Estimated: 3-4 days)

1. Create React hooks for event subscription
2. Implement state reconstruction logic
3. Handle reconnection with replay
4. Add loading states for history replay

### Phase 4: Optimization (Estimated: 2-3 days)

1. Add snapshot mechanism for long sessions
2. Implement GZIP compression for storage
3. Add TTL/cleanup for old sessions
4. Performance testing and tuning

## 6. File Structure

```
kiana/
├── src/
│   ├── pubsub/
│   │   ├── index.ts
│   │   ├── types.ts              # ConversationEvent, etc.
│   │   ├── SessionEventBus.ts    # In-memory pub-sub
│   │   └── ConversationStore.ts  # JSONL persistence
│   └── ...
webx/
├── src/
│   ├── app/api/
│   │   └── sessions/
│   │       └── [sessionId]/
│   │           ├── events/route.ts    # SSE endpoint
│   │           └── history/route.ts   # History endpoint
│   ├── hooks/
│   │   └── useSessionEvents.ts   # React hook for subscription
│   └── ...
```

## 7. Considerations

### 7.1 Scalability

- **Single Server**: EventEmitter works well for single-server deployments
- **Multi-Server**: Would need Redis Pub/Sub or similar for horizontal scaling
- **Storage**: VFS (crystal-vfs) can handle the JSONL files, or use local filesystem

### 7.2 Security

- Validate session access before allowing subscription
- Rate limit SSE connections per client
- Sanitize event data before persistence

### 7.3 Error Handling

- Handle write failures gracefully (retry, buffer)
- Reconnection logic for SSE clients
- Graceful degradation if storage unavailable

## 8. Conclusion

The proposed architecture provides:

1. **Low Storage Cost**: ~50KB-400KB per typical session, easily compressible
2. **Real-time Pub-Sub**: EventEmitter-based for single server, extensible to Redis
3. **Full History Replay**: JSONL format allows efficient streaming and filtering
4. **Flexible Client Support**: SSE works with web, CLI, and other clients

The implementation is modular and can be added incrementally without disrupting existing functionality.
