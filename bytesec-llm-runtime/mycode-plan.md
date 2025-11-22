# Core Agent Extraction Plan (Revised)

## Objectives
- Extract the LLM agent loop, model connectors, tool execution, and streaming into a standalone `./mycode` package.
- Keep runtime Bun-first; allow Node via polyfills, but prefer Bun APIs (e.g., `Bun.file`, `Bun.spawn`).
- Minimize coupling to opencode config/auth/storage; ship explicit, lightweight interfaces and adapters.

## Guiding Constraints
- Avoid `else`/`try`/`catch` unless essential; keep functions single-purpose and composable only when reuse is clear.
- Avoid `any`, prefer readonly data, use `const` over `let`.
- Keep registries and orchestrators thin; push complexity to well-named helpers.

## Target Layout
```
mycode/
└── src/
    ├── core/
    │   ├── agent.ts          # Conversation loop + tool calls + streaming
    │   ├── model.ts          # Provider registry + connections
    │   ├── tools.ts          # Tool registry + validation + execution
    │   └── streaming.ts      # Stream event emitter + helpers
    ├── types/
    │   ├── index.ts          # Public types
    │   └── events.ts         # Stream event shapes
    └── utils/
        ├── config.ts         # Config loader (Bun + env + JSON)
        └── logger.ts         # Minimal logger
```

## Runtime & Dependencies
- Runtime: Bun target; Node-compatible where straightforward (avoid Node-only deps when Bun APIs suffice).
- Core deps: `zod`, `openai`, `@anthropic-ai/sdk`, `eventemitter3`, `p-retry` (or custom retry), `undici` (if Bun fetch is insufficient), `cosmiconfig` (optional if Bun config adequate).
- Dev deps: `typescript`, `vitest`, `tsx`, `typedoc` (optional), `@types/node` only if Node shims required.

## Extraction Strategy
1) **Inventory & Scoping (short)**
   - Map current `src/provider`, `src/tool/registry.ts`, `src/session/prompt.ts` dependencies on config/auth/storage.
   - Decide adapter boundaries: what remains opencode-only vs what becomes interfaces in `mycode`.

2) **Types First**
   - Define public types (`ModelProvider`, `ModelConnection`, `Tool`, `ToolResult`, `ToolContext`, `StreamEvent`, `Message`, `Conversation`).
   - Document invariants (tool name uniqueness, event ordering, streaming states).

3) **Model Layer**
   - Implement provider registry with simple connect API.
   - Providers: OpenAI, Anthropic, Generic HTTP; rely on Bun fetch/Bun.file for HTTP bodies where possible.
   - Remove opencode config/auth; accept explicit API keys/config objects.

4) **Tool Framework**
   - Implement tool registry + validation via `zod`.
   - Built-ins: bash (via `Bun.spawn`), file read (`Bun.file`), HTTP fetch (`fetch`/`undici`).
   - Add permission hooks (callable predicates) rather than global policy.

5) **Streaming & Agent Loop**
   - Event emitter for text/tool_call/tool_result/error/done.
   - Core loop: generate → parse tool calls → execute → stream results → continue until done; keep retry/backoff pluggable.
   - Conversation memory: in-memory list with injectable store interface for future persistence.

6) **Config & Logging**
   - `config.ts`: load from env and optional config files (prefer Bun file I/O), validate with `zod`.
   - `logger.ts`: thin wrapper over `console` with levels; no heavy logging stack.

7) **Testing & Examples**
   - Unit: provider registry, tool registry, streaming emitter, agent loop step functions with mocked providers/tools.
   - Integration: sample conversations with deterministic mocked models; tool execution with sandboxed commands; streaming event ordering assertions.
   - Golden tests: fixture prompts with expected tool/event sequences to lock conversion behavior; compare JSON transcripts for automatic verification.
   - CLI example: minimal usage script whose stdout/stderr is snapshot-tested for regression detection.
   - Automation: `bun test` headless suite; typecheck + lint + tests wired for CI; optional contract tests for provider adapters using recorded fixtures.

8) **Docs & Migration**
   - README covering setup, minimal example, API surface.
   - Migration notes mapping opencode types/functions to `mycode` equivalents; list unsupported opencode features.

## Milestones
- M1: Types + provider registry skeleton + one provider (OpenAI) working.
- M2: Tool registry + built-ins + permission hooks.
- M3: Streaming emitter + core agent loop with retries.
- M4: Config/logging + examples + tests (unit/integration) + docs.

## Success Criteria
- Agent handles conversation with tool calls and streaming using only `mycode` artifacts.
- Providers and tools are pluggable without opencode dependencies.
- Bun-first APIs work; Node compatibility documented.
- Tests cover core paths; example script runs via `bun test`/`bun run`.

## Feasibility & Risks
- Dependency conflicts: verify Bun compatibility of AI SDKs and streaming helpers early; stub or swap Node-only pieces.
- Runtime target: decide Bun-only vs dual-target up front and document any required polyfills.
- Adapter complexity: design clean interfaces to replace opencode config/auth/storage; add contract tests to lock behavior.
- Tool permissions: define a narrow permission contract with predicate hooks; test allow/deny flows to avoid regressions.
- Determinism: maintain mock providers/tools and golden transcripts to confirm behavior matches current opencode flows during extraction.
