# Kiana Web

Browser UI for the Kiana AI SDK v6 agent with per‑session in‑memory filesystems (MemFS), streaming chat, and file import/export. Built with Next.js (App Router) and Tailwind CSS.

## Quick Start

- Prereqs: Node 18+, Bun, and valid ARK credentials
- Environment in `kiana/web/.env.local`:
  - `ARK_API_KEY=...`
  - `ARK_BASE_URL=...` (e.g. `https://ark-runtime-api.aiheima.com/v1`)
  - `ARK_MODEL_ID=...` (e.g. `gpt-4o-mini`)
- Run:
  - `cd kiana/web`
  - `bun install`
  - Dev: `bun run dev` → http://localhost:3000
  - Prod: `bun run build && bun run start`

## High‑Level Architecture

- UI (browser):
  - Left pane: sessions list (top) and MemFS tree (bottom), both resizable.
  - Right pane: chat interface with streaming output.
  - Components: `src/components/SessionList.tsx`, `src/components/FileTree.tsx`, `src/components/Chat.tsx`, `src/components/Resizable.tsx`.

- Server (Next API routes):
  - Sessions API: `app/api/sessions/route.ts:1` (create/list/remove sessions; in‑memory store, no persistence).
  - FS APIs: `app/api/fs/tree/route.ts:1`, `app/api/fs/import/route.ts:1`, `app/api/fs/export/route.ts:1`, `app/api/fs/file/route.ts:1`.
  - Chat API: `app/api/chat/route.ts:1` streams UI messages via AI SDK v6 `createAgentUIStreamResponse`.
  - Session store: `src/server/sessionStore.ts:1` (per‑session MemFS; seeds `/_system_prompt`).
  - Zip helper: `src/server/zip.ts:1` for exporting MemFS as a zip.

- Agent integration:
  - Uses local package link `@byted/kiana` pointing to `../kiana` and imports TypeScript sources under `@byted/kiana/src/*`.
  - Agent factory: `createKianaAgent` (AI SDK v6 ToolLoopAgent) imported in `app/api/chat/route.ts:1`.
  - Each session’s MemFS is bound as a tool `memfs_exec`; tool calls are session‑scoped.

- Streaming:
  - Chat route uses AI SDK v6 UI message protocol (`createAgentUIStreamResponse`).
  - Client uses `useChat` from `@ai-sdk/react` to stream assistant text and tool invocations.
  - Tool calls are rendered (including input, output, local start time, and duration).

- Environment separation:
  - ARK credentials are only dereferenced in server routes; nothing is exposed to the client.

- Dependencies:
  - `@byted/kiana` is linked via `file:../kiana` in `kiana/web/package.json:32`.
  - Next config enables `experimental.externalDir` and lists `@byted/kiana` in `transpilePackages` so Next compiles TS sources from the linked package.

## Local Package Link and TS Imports

- Web app depends on the local library: `@byted/kiana`: `file:../kiana` (see `kiana/web/package.json:32`).
- Import TS sources directly from the package, for example:
  - `@byted/kiana/src/KianaAgentV6`
  - `@byted/kiana/src/MemTools`
  - `@byted/kiana/src/MemFS`
- Next is configured to transpile the linked package:
  - `kiana/web/next.config.mjs:17` includes `@byted/kiana` in `transpilePackages` and `experimental.externalDir: true`.
  - This removes drift between library `src/` and compiled `lib/`, and avoids rebuilding the library for web usage.

## Conditional Bundling (Server‑Only VM2)

The Kiana MemFS supports a `node` command via `vm2`. This must never bundle into the browser. We conditionally include/exclude VM2 at build time.

- Why the change:
  - VM2 optionally requires `coffee-script`/`typescript` compilers, which break browser builds.
  - We only need VM2 on the server (API routes) where Node can load it dynamically.

- Implementation (conditional bundling):
  - `kiana/web/next.config.mjs:1`
    - Server build: mark `vm2`, `coffee-script`, and `typescript` as externals so webpack does not bundle them.
    - Client build: alias `vm2` to a stub (`src/server/shims/vm2.js:1`), and alias `coffee-script`/`typescript` to `false`.
  - Stub for client: `kiana/web/src/server/shims/vm2.js:1` — exports a minimal `NodeVM` that throws if called.

- Outcome:
  - Server routes can execute VM2 as part of MemFS execution (e.g., the `node` command).
  - Client bundle contains no VM2 or optional compilers; no coffee‑script resolution errors.

## File/Module Boundaries

- Linked package imports:
  - Use `@byted/kiana/src/...` for all shared logic (agent, MemFS, tools).
- External dir access:
  - `next.config.mjs` enables `experimental.externalDir: true` to allow importing from `../kiana`.

## API Contracts

- POST `/api/sessions`
  - Creates a session. Response: `{ session: { id, name?, createdAt } }`.
- GET `/api/sessions`
  - Lists sessions. Response: `{ sessions: [{ id, name?, createdAt, messageCount }] }`.
- GET `/api/fs/tree?sessionId=...`
  - Returns exported MemFS tree for the session.
- POST `/api/fs/import?sessionId=...`
  - Accepts `multipart/form-data` with multiple `file` fields. Supports folder import via `webkitdirectory`.
- GET `/api/fs/export?sessionId=...`
  - Returns a zip of the session’s MemFS.
- POST `/api/chat`
  - Body (AI SDK v6 UI messages): `{ sessionId, messages: UIMessage[], systemPrompt?, maxRounds? }`.
  - Fallback accepts `{ message: string }` and wraps it into a single UI user message.
  - Response streams AI SDK UI messages (assistant text parts, tool parts) for `useChat`.

## UI Behavior

- Resizable panes:
  - Horizontal divider between left/right panes.
  - Vertical divider between sessions list (top) and file tree (bottom).

- Import/export:
  - File tree toolbar: Import Files, Import Folder, Export Zip, Refresh.
  - After import completes, the input is reset so the same selection can be re‑imported.

- System prompt and editor:
  - Each session seeds `/_system_prompt` file. Chat route reads it unless an explicit `systemPrompt` is provided.
  - File tree includes “Edit Prompt” (modal editor for `/_system_prompt`) and “New File”.

- Tool calls UI:
  - `src/components/MemfsInvocationView.tsx:1` renders `memfs_exec` tool calls: command, status, local start time, and duration with copy/expand.

## Limitations and Notes

- Session store is in‑memory within a single Node process. Restart will clear sessions. For multi‑instance deployments, add persistence.
- VM2 is available only on server. Any attempt to execute VM2 in client code will throw from the stub.
- The chat endpoint streams via SSE; proxies that buffer streams may delay output.

## Extending

- Add tools: Extend tools in `kiana/kiana/src/KianaAgentV6.ts:1`. The web app imports TS from `@byted/kiana`, so no rebuild is required for the web.
- Persist sessions: Replace in‑memory store with Redis/DB and adjust APIs/UI.
- Auth: gate session creation and control export/import endpoints.

## Relevant Files

- `app/page.tsx:1` — main layout (resizable panes, mounts components)
- `app/api/chat/route.ts:1` — streaming chat, uses Kiana agent
- `src/server/sessionStore.ts:1` — per‑session MemFS store
- `src/server/zip.ts:1` — MemFS -> zip
- `src/components/SessionList.tsx:1` — session list
- `src/components/FileTree.tsx:1` — MemFS tree, import/export UI
- `src/components/Chat.tsx:1` — chat UI with AI SDK v6 `useChat`
- `next.config.mjs:1` — conditional bundling and externalDir
- `src/server/shims/vm2.js:1` — client‑side vm2 stub
