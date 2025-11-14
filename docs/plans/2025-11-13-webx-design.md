# webx Design Document

**Date:** 2025-11-13
**Project:** webx - Modern File Browser + Terminal Interface
**Stack:** Next.js 14, React 18, shadcn/ui, Tailwind CSS, AI SDK v6
**Foundation:** kiana's MemFS + MemShell

---

## 1. Vision & Goals

webx is a web-based file manager and terminal interface with integrated LLM agent capabilities, modeled after VS Code's layout. It combines:
- **File Explorer:** Browse, edit, import/export files in MemFS
- **Terminal:** Direct shell execution or LLM-powered agent mode
- **Mode Switching:** Seamless toggle between shell and agent modes via slash commands

### MVP Features (Must-Have)
- File browser with tree view
- Terminal with command execution
- Multi-pane layout (file explorer, editor, terminal)
- Mode switching: `/kiana` → agent mode, `/exit` → shell mode
- Import/export local files (zip)

### Nice-to-Have Features
- Syntax highlighting in file editor
- File search/navigation
- Command history & autocomplete
- Breadcrumb navigation

---

## 2. Overall Architecture & Layout

### Three-Pane Interface

```
┌─────────────────┬──────────────────────────────┐
│                 │                              │
│  File Explorer  │                              │
│                 │      File Editor/Preview     │
│  - Tree view    │                              │
│  - Import/Export│      (Main editing area)     │
│                 │                              │
├─────────────────┼──────────────────────────────┤
│                                                │
│              Terminal / Agent                  │
│         (Shell or LLM chat mode)               │
│                                                │
└────────────────────────────────────────────────┘
```

### Pane Responsibilities

**Left Pane (File Explorer):**
- Collapsible sidebar with resizable width
- File tree (nested directories/files)
- Breadcrumb navigation
- Action buttons: Import Files, Import Folder, Export ZIP, Refresh
- File operations: create, delete, rename (future enhancement)

**Main Pane (File Editor):**
- Displays selected file content
- Textarea for editing (syntax highlighting optional)
- Save button with pending indicator
- File path header showing current file location

**Bottom Pane (Terminal):**
- Two-mode interface: Shell Mode or Agent Mode
- Message-based UI (USER/ASSISTANT messages)
- Mode indicator (visual badge showing current mode)
- Command/message input field with Enter to send

---

## 3. Mode Switching & Command Flow

### Mode Definitions

**Shell Mode (Default)**
- Direct shell execution via MemShell
- User input executes immediately as shell command
- Responses are command output + exit code
- `/kiana [message]` switches to agent mode with optional initial prompt

**Agent Mode (LLM-Powered)**
- User messages sent to LLM agent
- Agent accesses MemShell tool to execute commands/edit files
- Real-time streaming of agent thoughts and tool invocations
- `/exit` returns to shell mode

### Command Flow

#### Shell Mode Flow
```
User enters: "ls -la /tmp"
       ↓
Frontend sends to /api/shell { sessionId, command }
       ↓
Backend executes via MemShell
       ↓
Returns { output, exitCode, error? }
       ↓
Display message pair:
  USER: ls -la /tmp
  SHELL: [output]
```

#### Agent Mode Flow
```
User enters: "/kiana show me all javascript files"
       ↓
Frontend switches mode to 'agent'
       ↓
Sends to /api/chat { sessionId, messages, mode: 'agent' }
       ↓
Backend streams LLM response with tool calls
       ↓
Agent calls MemShell tool (List, Read, Execute, WriteFile, etc.)
       ↓
Tool results stream back
       ↓
Display message pair + tool invocations:
  USER: show me all javascript files
  AGENT: [streaming response]
    ⏺ List(path: "/src")
      ⎿ preview of results...
      [expandable full output]
```

#### Mode Exit Flow
```
User enters: "/exit" (in agent mode)
       ↓
Frontend detects /exit command
       ↓
Switches mode to 'shell', doesn't send to LLM
       ↓
Display message: "Shell mode activated"
       ↓
Ready for next shell command
```

---

## 4. Component Structure & State Management

### Main Components

```
Page.tsx (root)
  ├── FileExplorer.tsx (left pane)
  │   ├── FileTree.tsx (nested tree view)
  │   ├── BreadcrumbNav.tsx
  │   └── FileActions.tsx (import/export buttons)
  │
  ├── FileEditor.tsx (main pane)
  │   ├── FileHeader.tsx (file path + buttons)
  │   └── Editor.tsx (textarea for content)
  │
  └── Terminal.tsx (bottom pane)
      ├── MessageList.tsx (conversation history)
      ├── ToolInvocationView.tsx (collapsible tool results)
      ├── ModeIndicator.tsx (visual mode badge)
      └── CommandInput.tsx (input field + send button)
```

### Global State (Page.tsx)

```typescript
const [activeSession, setActiveSession] = useState<string | null>(null);
const [selectedFilePath, setSelectedFilePath] = useState<string>('/');
const [fileContent, setFileContent] = useState<string>('');
const [mode, setMode] = useState<'shell' | 'agent'>('shell');
const [messages, setMessages] = useState<UIMessage[]>([]);
const [paneWidths, setPaneWidths] = useState({ explorer: 300, terminal: 300 });
```

### Hooks

- `useHorizontalResize` - Explorer/Editor divider (existing)
- `useVerticalResize` - Editor/Terminal divider (existing)
- `useChat` - LLM streaming integration (from @ai-sdk/react)

---

## 5. Data Flow & Message Format

### Message Format (Unified)

```typescript
type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: UIPart[];
  createdAt?: Date;
};

type UIPart =
  | { type: 'text'; text: string }
  | {
      type: 'tool-call';
      toolName: string;
      toolCallId: string;
      args: any;
      state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
      output?: any;
      errorText?: string;
    };
```

### API Endpoints

#### Existing (Reused)
- `GET /api/fs/tree?sessionId=X` - File tree structure
- `GET /api/fs/file?sessionId=X&path=Y` - Read file content
- `PUT /api/fs/file?sessionId=X` - Write file (body: { path, content })
- `POST /api/fs/import?sessionId=X` - Upload files (multipart form)
- `GET /api/fs/export?sessionId=X` - Download MemFS as zip
- `POST /api/chat` - LLM agent with streaming (reuse existing)

#### New
- `POST /api/shell` - Direct shell execution
  - Request: `{ sessionId, command }`
  - Response: Stream of `{ type: 'output' | 'exit', data: string | number }`

### Shell Execution Flow

```typescript
// Backend: /api/shell
export async function POST(req: NextRequest) {
  const { sessionId, command } = await req.json();
  const memtools = sessionStore.get(sessionId).memtools;
  const shell = memtools.getShell();

  const output = await shell.exec(command);
  return new Response(JSON.stringify({
    output: output.stdout,
    error: output.stderr,
    exitCode: output.exitCode,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## 6. Tool Result Preview UI

### Collapsible Tool Result Component

When agent executes a tool (List, Read, Execute, WriteFile), display:

#### Collapsed State (Preview)
```
⏺ List(path: "/Users/joohwi.lee/crystal/test_next_js/src/api")
  ⎿ - /Users/joohwi.lee/crystal/test_next_js/src/api/
     - CNOG_CLIENT_FRONTEND_POLICY_GUIDE.md
     - cnog-api/
       - cnog_client_direct_example.js
    ... (+28 item(s))

[Click to expand or scroll for full output]
```

#### Expanded State (Full)
```
⏺ List(path: "/Users/joohwi.lee/crystal/test_next_js/src/api")
  ⎿ [Scrollable max-height container]
     - /Users/joohwi.lee/crystal/test_next_js/src/api/
     - CNOG_CLIENT_FRONTEND_POLICY_GUIDE.md
     - cnog-api/
       - cnog_client_direct_example.js
     - cnog_client_direct_example.js
     - cnog_client_example.ts
     [... full list continues ...]
    [Collapse button]
```

### Preview Rules

| Tool | Preview Behavior |
|------|------------------|
| `List` | Show first 5 items + count indicator |
| `Read` | Show first 10 lines + count indicator |
| `Execute` | Show first 20 lines of stdout + count |
| `WriteFile` | Show "✓ Written N bytes to path" |
| Error | Show full error message always |

### Implementation

- Extract output type (array/string/object)
- Count total items/lines
- Slice to preview size
- Add expandable toggle button
- Rendered in collapsible `<details>` element with custom styling

---

## 7. Technology Stack

### Frontend
- **Next.js 14** - React framework
- **React 18** - UI library
- **shadcn/ui** - Component library
- **Tailwind CSS** - Styling
- **AI SDK v6** - LLM streaming (`@ai-sdk/react`, `ai`)
- **clsx** - Class name utilities

### Backend
- **Next.js Route Handlers** - API endpoints
- **Kiana MemTools** - File system & shell access
- **Kiana Agent** - LLM integration with tools

### Environment Variables
```
ARK_MODEL_ID=ep-20250821060450-4bc6g
ARK_API_KEY=23ed9d5c-c634-4cc1-9e70-9c9ac63a17ef
ARK_BASE_URL=https://ark-ap-southeast.byteintl.net/api/v3
```

---

## 8. Implementation Phases

### Phase 1: Project Setup & Layout
1. Create `/webx` directory with Next.js scaffold
2. Copy `.env.local` from `/web`
3. Set up base layout with three resizable panes
4. Integrate existing FileTree component
5. Create Terminal stub component

### Phase 2: File Operations
1. Implement FileEditor component with read/write
2. Connect file selection → editor update
3. Add file actions (create, import, export)
4. Sync file tree on changes

### Phase 3: Shell Mode
1. Implement `/api/shell` endpoint
2. Create CommandInput component
3. Handle shell command execution
4. Display command results as messages

### Phase 4: Agent Mode
1. Implement mode switching logic (`/kiana`, `/exit`)
2. Create ToolInvocationView with preview/expand
3. Reuse existing `/api/chat` endpoint
4. Test LLM streaming integration

### Phase 5: Polish & Refinement
1. Add syntax highlighting (optional)
2. Improve UX with visual feedback
3. Command history (optional)
4. Test import/export workflows

---

## 9. Success Criteria

- ✅ Three-pane layout renders correctly
- ✅ File explorer shows MemFS tree
- ✅ File editor reads/writes files
- ✅ Shell mode executes commands and displays output
- ✅ Agent mode streams LLM responses with tool calls
- ✅ Mode switching with `/kiana` and `/exit` works
- ✅ Tool results show preview + expandable full output
- ✅ Import/export functionality works
- ✅ All existing MemShell tools accessible

---

## 10. Future Enhancements

- Syntax highlighting for file editor (Prism or Monaco)
- File search/filter in explorer
- Command history & autocomplete in shell mode
- Create/delete/rename files from UI
- Diff viewer for file changes
- Multiple file tabs in editor
- Dark/light theme toggle
- Session persistence
- Collaborative editing (future)

