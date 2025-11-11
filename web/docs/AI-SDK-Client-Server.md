# AI SDK v6 Client–Server Interaction and Architecture

This document explains how the AI SDK v6 “UI message” protocol works from the wire level (SSE) up to client/server APIs, and proposes patterns for:

- Running a server in other languages (e.g., Go) or with different agent frameworks
- Mixing client-side and server-side tools (e.g., MCP on the server; UI tools in browser)
- Extending the same protocol to a CLI
- Security considerations

## Mental Model

- Client submits UI messages (structured chat turns) to a server route.
- Server runs an agent with tools and streams UIMessageChunk events over SSE.
- Client assembles chunks into UI messages, rendering text and tools progressively.
- Tools can run on the server (classic) or be flagged for client execution (dynamic UI tools).

## Wire Protocol (SSE)

- Transport: Server-Sent Events with headers (AI SDK v6 defaults):
  - `content-type: text/event-stream`
  - `cache-control: no-cache`
  - `connection: keep-alive`
  - `x-vercel-ai-ui-message-stream: v1`
  - `x-accel-buffering: no`
- Body: newline-delimited records of the form:

  ```
  data: {"type":"text-delta","delta":"Hello"}

  data: {"type":"tool-input-start","toolCallId":"T1","toolName":"memfs_exec"}

  data: {"type":"tool-output-available","toolCallId":"T1","output":{"result":"ok","success":true}}

  data: {"type":"finish"}
  ```

- UIMessageChunk types (selected):
  - Text: `text-start`, `text-delta`, `text-end`
  - Reasoning: `reasoning-start`, `reasoning-delta`, `reasoning-end`
  - Tool input: `tool-input-start`, `tool-input-delta`, `tool-input-available`, `tool-input-error`
  - Tool output: `tool-output-available`, `tool-output-error`, `tool-output-denied`
  - Tool approval: `tool-approval-request`
  - Data parts: `source-url`, `source-document`, `file`
  - Lifecycle: `start`, `finish`, `abort`, `start-step`, `finish-step`, `message-metadata`

Each tool event carries a stable `toolCallId`. Dynamic tools set `dynamic: true` to signal client-side execution.

## Server API (TypeScript/Node Reference)

- Chat endpoint: accepts UI messages and streams UI chunks.

  - Request body (preferred):
    ```json
    {
      "id": "chat-or-session-id",
      "messages": [ { "id":"u1", "role":"user", "parts":[{"type":"text","text":"Hi"}] } ],
      "systemPrompt": "... (optional)",
      "maxRounds": 20
    }
    ```
  - Fallback legacy: `{ "message": "hi" }` (server wraps it into a UI message).
  - Response: SSE stream of `UIMessageChunk` records.

- Agent runtime (example): ToolLoopAgent with tools, e.g., `memfs_exec` bound to your per-session MemFS.
- Streaming helpers:
  - `createAgentUIStreamResponse({ agent, messages })` — writes SSE directly from a Next.js route/Node handler.

## Client API (Browser)

- React hook: `useChat` from `@ai-sdk/react`.
  - Configure `id` (chat/session), `api` (server route), and optional `body` fields (e.g., `sessionId`).
  - Renders text via `isTextUIPart(part)` and tools via `isToolOrDynamicToolUIPart(part)`.
  - Tool rendering can be custom per tool name; unknown tools can be shown generically.

## Cross-Language Server Design (Go)

Goal: Implement the same UIMessageChunk SSE protocol with a Go-based agent framework.

### Components

- HTTP route: `POST /api/chat`
  - Parses request into a `[]UIMessage` (your struct matching the AI SDK shape).
  - Translates UI messages to provider messages (OpenAI-compatible, etc.).
  - Starts an agent loop and writes SSE chunks (UIMessageChunk) as events occur.

- Agent adapter:
  - Map your framework’s events to `UIMessageChunk` types.
  - Emit `text-delta` for streamed text; emit tool lifecycle events with consistent `toolCallId`.

- Tool router:
  - Server tools: execute within the route process; emit `tool-output-*`.
  - Dynamic (client) tools: emit `tool-input-available` with `dynamic: true`; optionally emit `tool-approval-request`.

- SSE writer:
  - Set headers above; `Flush()` after each `data:` record.
  - Write `\n\n` between records; handle aborts cleanly.

### Benefits

- Client stays unchanged (still uses `useChat`).
- You can swap models/providers/frameworks server-side.

## Mixing Client and Server Tools

- Server tools (classic): run on server with secrets and privileged access (e.g., MCP, DB, filesystem, build runners). Emit `tool-input-*` and `tool-output-*` events. The browser only renders.

- Client tools (dynamic UI): server emits `tool-input-available` with `dynamic: true`. Client renders a custom UI (forms, pickers, viewers) and either:
  - Submits an approval/response via a side endpoint (tool approval), or
  - Sends a follow-up user message carrying the result (e.g., JSON in a text part or data parts).

- Hybrid patterns:
  - Server emits `tool-approval-request` for sensitive ops (e.g., file writes). Client displays a dialog; result unblocks the agent step.
  - Offload user-dependent inputs (like OAuth or file pickers) to the client, while keeping privileged execution on the server.

## CLI Extension

- Local mode (in-process): use `createAgentUIStream({ agent, messages })`; print text deltas and tool outputs to TTY.
- Remote mode (reuses server): use `DefaultChatTransport` and `readUIMessageStream` to consume the same SSE protocol from `/api/chat`.
- Tool handling:
  - Server tools: print outputs.
  - Client/dynamic tools: either skip, prompt in TUI, or post back a response via a small approval endpoint.

## Security Considerations

- Tool boundaries
  - Server tools: sandbox (e.g., vm2 for JS; jailed shells), enforce allowlists for FS/network.
  - MCP tools: limit resource scope (e.g., repo root), enforce read-only when possible.
  - Never expose host secrets in outputs; redact logs.

- Secrets
  - Keep provider API keys server-only; never stream or embed in tool outputs.
  - Use environment scoping and CI secrets stores; avoid client exposure.

- Protocol integrity
  - CORS and auth: restrict `/api/chat` to authorized origins/users.
  - Rate limit per session/user; prevent abuse and resource exhaustion.
  - Abort handling: support client cancellation and cleanly stop long-running tools.

- Session isolation
  - Per-session state keyed by `sessionId` and never shared.
  - Sign or bind sessions to user identity for multi-user deployments.

- Client dynamic tools
  - Treat inputs as untrusted; sanitize before injecting into DOM.
  - Do not perform privileged actions client-side; route approvals or execution to the server.

## Minimal TS Examples (Pointers)

- Server chat route (streaming UI chunks): `kiana/web/app/api/chat/route.ts`
- Client chat UI (useChat + tool rendering): `kiana/web/src/components/Chat.tsx`
- CLI (local/remote): `kiana/kiana/src/cli/chat.ts`

## Glossary

- UIMessage: a single chat message with `role` and `parts` (text/data/tool parts).
- UIMessageChunk: a stream fragment carrying deltas or tool lifecycle events.
- Dynamic tool: a tool invocation intended to execute in the client (browser) rather than on the server.

