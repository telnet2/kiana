# webx - Modern File Manager + Terminal

A web-based file manager and terminal interface with integrated LLM agent capabilities, built on top of kiana's MemFS and MemShell.

## Features

### Three-Pane Layout
- **Left Sidebar**: Session management + File explorer with import/export
- **Main Pane**: File editor with syntax highlighting and save functionality
- **Bottom Pane**: Dual-mode terminal (Shell mode or Agent mode)

### Dual-Mode Terminal
- **Shell Mode** (default): Direct shell command execution via MemShell
  - Command history with arrow key navigation (↑/↓)
  - Exit codes and output display
  - `/kiana` to switch to agent mode

- **Agent Mode**: LLM-powered terminal with tool access
  - Claude can execute shell commands, read/write files
  - Tool result previews with expand/collapse
  - `/exit` to switch back to shell mode

### File Management
- Create files and directories
- Edit and save file contents
- Import files/folders (zip upload)
- Export entire MemFS as zip
- Real-time file tree updates

## Getting Started

### Install Dependencies
```bash
cd webx
bun install
```

### Environment Variables
Copy `.env.local` with ARK credentials:
```
ARK_MODEL_ID=ep-20250821060450-4bc6g
ARK_API_KEY=23ed9d5c-c634-4cc1-9e70-9c9ac63a17ef
ARK_BASE_URL=https://ark-ap-southeast.byteintl.net/api/v3
```

### Run Development Server
```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Shell Mode
```bash
$ ls -la
$ cat file.txt
$ mkdir mydir
$ /kiana "What files are in this directory?"  # Switch to agent mode
```

### Agent Mode
```
/kiana show me all javascript files
# Agent will use tools to explore and report findings

/exit  # Return to shell mode
```

### File Management
1. **Create File**: Click "New File" in explorer sidebar
2. **Edit**: Click file in explorer to open in editor
3. **Save**: Click "Save" button or Cmd+S
4. **Import**: Click "Import Files" or "Import Folder"
5. **Export**: Click "Export ZIP" to download entire filesystem

## Architecture

### Backend (Next.js)
- **Sessions**: In-memory session management
- **File System**: MemFS API endpoints
- **Shell**: Direct shell execution
- **Chat**: LLM agent with streaming

### Frontend (React + TypeScript)
- Session list with creation
- File tree explorer
- File editor with unsaved state tracking
- Terminal with mode switching
- Tool result visualization

## API Endpoints

### Sessions
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session

### File System
- `GET /api/fs/tree` - File tree structure
- `GET/PUT /api/fs/file` - Read/write files
- `POST /api/fs/create` - Create file/directory
- `POST /api/fs/import` - Upload files
- `GET /api/fs/export` - Download as zip

### Terminal
- `POST /api/shell` - Execute shell command
- `POST /api/chat` - LLM agent with tool access

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js Route Handlers, Node.js
- **LLM**: AI SDK v6, ARK/Claude
- **File System**: Kiana MemFS
- **Shell**: Kiana MemShell

## Tips

- Use arrow keys (↑/↓) to navigate shell command history
- Tool results show first 5 items/lines - click to expand full output
- Files are automatically saved to MemFS - export to backup
- Sessions persist in memory during dev server runtime
- Mode indicator shows current terminal mode (top right)
