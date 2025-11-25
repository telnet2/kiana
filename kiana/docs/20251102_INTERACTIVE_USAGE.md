# Kiana Interactive Mode

Interactive mode enables conversational AI interaction with your in-memory filesystem. Ask Kiana to complete tasks in natural language, and watch as it executes commands, displays tool calls, and streams responses.

## Quick Start

```bash
$ memsh
memsh:/$ kiana
[Entering Kiana Interactive Mode]
Type /exit to return to shell mode

kiana:/$ Create a TypeScript project with tests
```

## Mode Overview

### Shell Mode (Default)
- Prompt: `memsh:[dir]$`
- Execute traditional shell commands
- Direct file operations
- View results immediately

### Kiana Interactive Mode
- Prompt: `kiana:[dir]>`
- Conversational task description
- Automatic tool execution
- Streamed responses

### Switching Between Modes

**Enter Kiana Mode**
```
memsh:/$ kiana
```

**Return to Shell Mode**
```
kiana:/$ /exit
```

## How It Works

### Message Flow

```
1. User enters message
   kiana:/$ "Create app structure"

2. Kiana sends to LLM
   → LLM receives your task and system context

3. LLM generates tool calls
   → Creates plan to accomplish task

4. Tool execution begins
   → 🔧 mkdir -p /src
   → 🔧 write /package.json "..."
   → 🔧 npm install

5. Tool results displayed
   → ✓ Created directory
   → ✓ File written
   → ✓ Packages installed

6. LLM response streamed
   → "I've created your app structure with..."
   → Progressive character-by-character output

7. Ready for next message
   → Prompt returns
```

## Example Workflows

### Create a Project Structure

```
kiana:/$ Create a TypeScript project with src, tests, and npm setup
🔧 memfs_exec: mkdir -p /project/src
✓ Result: Created directory

🔧 memfs_exec: mkdir -p /project/tests
✓ Result: Created directory

🔧 memfs_exec: write /project/package.json "{"name":"project"...}"
✓ Result: File created

Kiana: I've created a TypeScript project structure with:
- /project/src for source code
- /project/tests for test files
- package.json configured for npm
```

### Develop an App

```
kiana:/$ Add an API endpoint that handles user requests

🔧 memfs_exec: cat /app/src/server.js
✓ Result: File read (428 bytes)

🔧 memfs_exec: write /app/src/server.js "const express = require('express')..."
✓ Result: File updated

Kiana: I've added an API endpoint at POST /users that validates
input and returns a structured response. The endpoint includes...
```

### Debug and Fix Issues

```
kiana:/$ Run tests and fix any failures

🔧 memfs_exec: node /tests/run.js
✓ Result: 3 test failures detected

🔧 memfs_exec: cat /src/validator.js
✓ Result: File read

🔧 memfs_exec: write /src/validator.js "..."
✓ Result: Fixed validation logic

🔧 memfs_exec: node /tests/run.js
✓ Result: All 10 tests passing

Kiana: All tests are now passing! I fixed three issues in the
validation logic that were causing failures with edge cases.
```

## Session State Management

Your session state persists across mode switches:

### Working Directory
```
memsh:/$ cd /app
memsh:/app$ kiana
kiana:/app> (working directory is /app)
kiana:/app$ /exit
memsh:/app$ (working directory still /app)
```

### Environment Variables
```
memsh:/$ export NODE_ENV=production
memsh:/$ kiana
kiana:/$ Create an optimized build
(NODE_ENV=production is available to Kiana)
```

### Command History
```
memsh:/$ mkdir test
memsh:/$ kiana
kiana:/$ /exit
memsh:/$ history
1  mkdir test
2  kiana
```

## Streaming Output

The interactive mode uses progressive output rendering:

### Tool Calls
As Kiana plans its actions, tool calls appear as they're decided:
```
🔧 mkdir -p /src
🔧 write /package.json "..."
```

### Tool Results
After each tool executes:
```
✓ Created directory
✓ File written
```

### LLM Response
The final response from Kiana streams progressively:
```
Kiana: I've created the project... (text streams in real-time)
```

## Commands

### Exit Interactive Mode
```
kiana:/$ /exit
```

### Request Help
Use natural language within Kiana mode:
```
kiana:/$ Help me understand the test failures
```

## Configuration

### Model Selection
Change the LLM model (default: gpt-4o-mini):
```typescript
const kiana = new KianaInteractive(shell, {
    model: 'gpt-4-turbo',
});
```

### Max Rounds
Limit tool execution rounds (default: 20):
```typescript
const kiana = new KianaInteractive(shell, {
    maxRounds: 5,
});
```

### Custom Writer
Use different output backends:
```typescript
const { SSEWriter } = require('kiana');

const writer = new SSEWriter((event) => {
    // Send to web app, log, etc.
});

const kiana = new KianaInteractive(shell, { writer });
```

## Web App Integration

The architecture supports HTTP streaming for web applications:

```typescript
// HTTP endpoint
app.post('/api/kiana/message', async (req, res) => {
    const { sessionId, message } = req.body;
    
    const session = sessionStore.get(sessionId);
    const writer = new SSEWriter((event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    
    const kiana = new KianaInteractive(session.shell, { writer });
    await kiana.sendMessage(message);
});
```

Frontend receives streaming events:
- `tool_call` - Kiana is executing a command
- `tool_result` - Command result available
- `response_chunk` - Part of Kiana's message

## Architecture

### Components

**KianaInteractive**
- Wraps KianaAgent for interactive use
- Manages conversation state
- Handles streaming output

**MemREPL**
- Main shell REPL
- Detects "kiana" command
- Routes to KianaInteractive
- Manages mode switching

**MemSession**
- Tracks command history
- Stores environment variables
- Maintains working directory
- Shared across modes

**Writer Interface**
- StdoutWriter - Direct terminal output
- SSEWriter - HTTP event streaming
- BufferWriter - In-memory buffering
- MultiWriter - Multiple outputs

### Data Flow

```
User Input (readline)
    ↓
MemREPL.handleCommand()
    ├─ Shell mode
    │  ├─ "kiana" → enterKianaMode()
    │  └─ Regular command → shell.exec()
    │
    └─ Kiana mode
       ├─ "/exit" → exit Kiana mode
       └─ Message → kiana.sendMessage()
                      → KianaAgent.runKiana()
                         → LLM API call
                         → Tool execution loop
                         → Stream responses
```

## Examples

See `examples/kiana-interactive-example.js` for comprehensive examples.

## API Reference

### KianaInteractive

```typescript
class KianaInteractive {
    // Constructor
    constructor(shell: MemShell, options?: {
        writer?: Writer;
        systemPrompt?: string;
        model?: string;
        maxRounds?: number;
        apiKey?: string;
    });

    // Get the prompt string
    getPrompt(): string;

    // Check if mode is active
    isActive(): boolean;

    // Send a message and stream response
    async sendMessage(message: string, customWriter?: Writer): Promise<void>;

    // Exit interactive mode
    exit(): void;

    // Get session from shell
    getSession(): MemSession;

    // Get shell instance
    getShell(): MemShell;
}
```

## Troubleshooting

### "OPENAI_API_KEY not set"
Set your OpenAI API key:
```bash
export OPENAI_API_KEY=sk-...
```

### Message hangs
Check network connection and OpenAI API status.

### Commands not executing
Verify file paths and permissions in MemFS. Use `ls` in shell mode to debug.

### Slow responses
Model performance varies. Try `gpt-4o-mini` (faster) vs `gpt-4-turbo` (more capable).

## Future Enhancements

- [ ] Conversation history export
- [ ] Undo/redo for tool calls
- [ ] Interactive debugging mode
- [ ] Multi-turn refinements with `/refine`
- [ ] Web UI dashboard
- [ ] Session persistence to disk
- [ ] Team collaboration features
- [ ] Custom system prompts per project
