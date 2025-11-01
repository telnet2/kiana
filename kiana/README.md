# Kiana

MemFS-based LLM agent and in-memory shell utilities. Built for Bun workflows.

## Features

### In-Memory File System (MemFS)
A complete in-memory file system implementation with:
- File and directory operations
- Path resolution (relative and absolute)
- Import/export to real filesystem
- Full POSIX-like API

### Shell Command REPL (MemShell)
An interactive shell with POSIX-like commands:
- **Navigation**: `ls`, `cd`, `pwd`
- **File Operations**: `cat`, `touch`, `rm`, `mkdir`, `write`
- **Search & Manipulation**: `grep`, `find`, `sed`
- **Import/Export**: `import`, `export`
- **Execution**: `node` (run JavaScript in the memory filesystem)
- **Advanced**: Pipes (`|`) and HEREDOC (`<<`) support

### Interactive Shell (MemREPL)
A full-featured REPL interface for interactive file system manipulation.

### LLM Tool Interface (MemTools)
Integration with Large Language Models (LLMs) via function calling:
- **Single Tool API**: Execute any shell command through a simple tool interface
- **Multi-format Support**: OpenAI, Anthropic, MCP (Model Context Protocol)
- **Stateful Context**: Maintain file system state across multiple LLM interactions
- **State Export/Import**: Persist and restore file system state
- **Real-world Use Cases**: Code generation, log analysis, project scaffolding

## Installation (Bun)

Use Bun for dependency management and running scripts in this repository:

```bash
# Install dependencies
bun install

# Build TypeScript -> JavaScript (outputs to lib/)
bun run build

# Run tests (Mocha via npm script)
bun run test
```

Directory structure:
- kiana/src/ — TypeScript sources
- kiana/lib/ — Compiled JavaScript output
- kiana/bin/ — CLI entry points (e.g., memsh)
- kiana/examples/ — Example scripts and demos
- kiana/test/ — Test files
- kiana/tsconfig.json — TypeScript configuration

## Quick Start

### Interactive Shell

Start the interactive shell with Bun:
```bash
bun ./bin/memsh
```

### Programmatic API

```javascript
const { MemFS, MemShell } = require('@byted/kiana');

// Create file system
const fs = new MemFS();
fs.createDirectory('mydir');
fs.createFile('mydir/hello.txt', 'Hello World');

// Use shell commands
const shell = new MemShell(fs);
console.log(shell.exec('ls mydir'));
console.log(shell.exec('cat mydir/hello.txt'));
```

### Kiana Agent (Tool)

Kiana is an LLM agent that uses OpenAI and MemTools to execute shell commands inside the in-memory filesystem.

Requirements:
- Set your OpenAI API key: `export OPENAI_API_KEY=sk-...`

Usage inside the shell:
```bash
# Show manual page for the kiana tool
memsh -c "man kiana"

# Run with a direct instruction
memsh -c "kiana \"Create a hello.txt file with 'Hello from Kiana!'\""

# Run with an instruction file stored in MemFS
memsh -c "write task.txt \"List files and create README.md\""
memsh -c "kiana --instruction task.txt"

# Specify model and enable verbose logging
memsh -c "kiana --model gpt-4o --verbose \"Summarize the project files\""
```

Options:
- `--instruction <text|memfs_file>`: Task instruction (positional or flag)
- `--system-prompt <memfs_file>`: Provide a custom system prompt from MemFS
- `--model <name>`: OpenAI model to use (default: `gpt-4o-mini`)
- `--max-rounds <n>`: Maximum tool-call rounds (default: `20`)
- `--verbose`: Enable verbose logging

Programmatic usage via MemTools:
```javascript
const { MemTools } = require('@byted/kiana');
const memtools = new MemTools();

memtools.exec('write task.txt "Create a file named hello.txt with content"');
const output = memtools.exec('kiana --instruction task.txt');
console.log(output);
```

References:
- Kiana command implementation: <mcfile name="kiana.ts" path="/Users/joohwi.lee/crystal/kiana/kiana/src/commands/kiana.ts"></mcfile> <mcsymbol name="kiana" filename="kiana.ts" path="/Users/joohwi.lee/crystal/kiana/kiana/src/commands/kiana.ts" startline="11" type="function"></mcsymbol>
- Agent runner: <mcfile name="KianaAgent.ts" path="/Users/joohwi.lee/crystal/kiana/kiana/src/KianaAgent.ts"></mcfile> <mcsymbol name="runKiana" filename="KianaAgent.ts" path="/Users/joohwi.lee/crystal/kiana/kiana/src/KianaAgent.ts" startline="269" type="function"></mcsymbol> <mcsymbol name="DEFAULT_SYSTEM_PROMPT" filename="KianaAgent.ts" path="/Users/joohwi.lee/crystal/kiana/kiana/src/KianaAgent.ts" startline="18" type="function"></mcsymbol>
- Shell CLI entry: <mcfile name="memsh" path="/Users/joohwi.lee/crystal/kiana/kiana/bin/memsh"></mcfile>
- Demo: <mcfile name="kiana-demo.js" path="/Users/joohwi.lee/crystal/kiana/kiana/examples/kiana-demo.js"></mcfile>

## Command Reference

### File System Navigation

#### `ls [options] [path]`
List directory contents
- `-l`: Long format with details
- `-a`: Show all entries including `.` and `..`

```bash
$ ls
$ ls -l
$ ls -la /projects
```

#### `cd [path]`
Change directory
```bash
$ cd /projects/myapp
$ cd ..
$ cd
```

#### `pwd`
Print working directory
```bash
$ pwd
```

### File Operations

#### `cat <file...>`
Display file contents
```bash
$ cat file.txt
$ cat file1.txt file2.txt
```

#### `touch <file...>`
Create empty file or update timestamp
```bash
$ touch newfile.txt
$ touch file1.txt file2.txt
```

#### `mkdir [options] <dir...>`
Create directory
- `-p`: Create parent directories as needed

```bash
$ mkdir mydir
$ mkdir -p projects/myapp/src
```

#### `rm [options] <path...>`
Remove files or directories
- `-r`, `-R`: Recursive removal

```bash
$ rm file.txt
$ rm -r mydir
```

#### `write <file> <content>`
Write content to file
```bash
$ write hello.txt "Hello World"
$ write script.js "console.log('test');"
```

### Search and Manipulation

#### `grep [options] <pattern> <file...>`
Search for patterns in files
- `-i`: Case insensitive
- `-n`: Show line numbers

```bash
$ grep "TODO" file.txt
$ grep -n "function" script.js
$ grep -i "error" *.log
```

#### `find [options] [path]`
Find files in directory hierarchy
- `--name <pattern>`: Match name pattern
- `--type <f|d>`: Filter by type (file or directory)

```bash
$ find .
$ find . --name "*.js"
$ find /projects --type d
```

#### `sed <s/pattern/replacement/flags> <file>`
Stream editor for text transformation
```bash
$ sed s/old/new/g file.txt
$ sed s/foo/bar/ test.txt
```

### Import/Export

#### `import [options] <real-path> [mem-path]`
Import from real filesystem
- `-r`, `-R`: Recursive (for directories)

```bash
$ import /path/to/file.txt
$ import -r /path/to/directory mydir
```

#### `export <mem-path> <real-path>`
Export to real filesystem
```bash
$ export myfile.txt /tmp/myfile.txt
$ export mydir /tmp/exported
```

### Execution

#### `node <script.js> [args...]`
Execute JavaScript file in memory filesystem
```bash
$ node script.js
$ node main.js arg1 arg2
```

Features:
- Full console support (log, error, warn)
- `require()` for memory filesystem modules
- `process.argv` access
- Built-in Node.js module support

### Utility

#### `echo <text...>`
Display text
```bash
$ echo Hello World
```

#### `help`
Show help message
```bash
$ help
```

#### `exit`, `quit`
Exit the shell
```bash
$ exit
```

### Advanced Features

#### Pipes (`|`)
Chain commands together, passing output from one command as input to the next.

**Syntax:** `command1 | command2 | command3`

**Examples:**
```bash
# Filter file contents
$ cat file.txt | grep error

# Chain multiple filters
$ cat log.txt | grep ERROR | sed s/ERROR/CRITICAL/g

# Count matching lines
$ cat data.txt | grep pattern | wc -l

# Find and filter
$ ls | grep ".js"

# Process with line numbers
$ cat file.txt | grep -n important
```

**Supported Commands:**
- `cat` - Can receive stdin when no files specified or with `-`
- `grep` - Can search stdin when no files specified
- `sed` - Can transform stdin when no file specified
- Any command can be piped to these commands

#### HEREDOC (`<<`)
Multi-line input delimiter for creating documents inline.

**Syntax:**
```bash
command << DELIMITER
content line 1
content line 2
...
DELIMITER
```

**Interactive Mode:**
```bash
$ cat << EOF
> This is line 1
> This is line 2
> EOF
This is line 1
This is line 2
```

**Inline Mode (in scripts/programmatic usage):**
```javascript
shell.exec(`cat << EOF
line 1
line 2
EOF`);
```

**Examples:**

Create a file with multi-line content:
```bash
$ write config.yaml << END
> server:
>   host: localhost
>   port: 8080
> database:
>   name: mydb
> END
```

Search through inline content:
```bash
$ grep error << DATA
> normal line
> error occurred here
> another normal line
> DATA
error occurred here
```

Transform inline content:
```bash
$ sed s/old/new/g << TEXT
> old value 1
> old value 2
> TEXT
new value 1
new value 2
```

#### Combining Pipes and HEREDOC

Pipe HEREDOC output to other commands:
```bash
$ cat << EOF | grep pattern | sed s/find/replace/g
> line with pattern and find
> another line
> line with pattern
> EOF
```

Complex pipeline example:
```bash
$ cat << DATA | grep -n error | sed s/error/ERROR/g
> normal operation
> error in system
> processing continues
> error detected
> DATA
2:ERROR in system
4:ERROR detected
```

**Use Cases:**
- **Testing**: Create test data inline without external files
- **Configuration**: Generate config files programmatically
- **Data Processing**: Process multi-line data in pipelines
- **Scripting**: Embed documents in shell scripts
- **Prototyping**: Quickly test text transformations

#### Output Redirection

Redirect command output to files using POSIX-compliant redirection operators.

**Operators:**
- `>` - Redirect stdout to file (overwrite)
- `>>` - Redirect stdout to file (append)

**Syntax:**
```bash
command > file.txt           # Overwrite
command >> file.txt          # Append
command | other > file.txt   # Redirect piped output
```

**Examples:**

Redirect output to file:
```bash
$ echo "Hello World" > greeting.txt
$ cat greeting.txt
Hello World
```

Append to existing file:
```bash
$ echo "Line 1" > log.txt
$ echo "Line 2" >> log.txt
$ cat log.txt
Line 1
Line 2
```

Redirect command output:
```bash
$ ls -l > directory-listing.txt
$ grep "error" file.txt > errors.txt
$ find . --name "*.js" > javascript-files.txt
```

Redirect piped output:
```bash
$ cat data.txt | grep "important" > filtered.txt
$ cat log.txt | sed s/ERROR/CRITICAL/g > updated-log.txt
$ cat file.txt | grep -n "TODO" > todo-items.txt
```

**POSIX-Compliant HEREDOC with Output Redirection:**

The proper POSIX syntax for creating files with HEREDOC uses output redirection:

```bash
$ cat > config.yaml << EOF
> server:
>   host: localhost
>   port: 8080
> database:
>   name: mydb
> EOF
$ cat config.yaml
server:
  host: localhost
  port: 8080
database:
  name: mydb
```

Append with HEREDOC:
```bash
$ cat >> log.txt << END
> [INFO] Application started
> [INFO] Connected to database
> END
```

Create JavaScript files:
```bash
$ cat > script.js << CODE
> console.log('Hello, World!');
> console.log('This is a test');
> CODE
$ node script.js
Hello, World!
This is a test
```

**Combined with Pipes:**
```bash
# Process and save to file
$ cat << DATA | grep -n error | sed s/error/ERROR/g > processed.txt
> normal line
> error found here
> another error
> DATA

# Multiple transformations with output
$ cat file.txt | grep "pattern" | sed s/old/new/g > result.txt
```

**Practical Examples:**

Generate and save configuration:
```bash
$ cat > .env << ENV
> DATABASE_URL=postgresql://localhost/mydb
> API_KEY=secret123
> DEBUG=true
> ENV
```

Create multiple files:
```bash
$ echo "# My Project" > README.md
$ cat > package.json << JSON
> {
>   "name": "my-app",
>   "version": "1.0.0"
> }
> JSON
```

Process and save results:
```bash
$ import /path/to/data.csv
$ cat data.csv | grep "error" > errors.csv
$ cat data.csv | grep -v "error" > valid.csv
$ export errors.csv /path/to/errors.csv
```

## LLM Tool Integration

### Overview

MemTools provides a simple, powerful interface for integrating the in-memory file system with Large Language Models (LLMs). Instead of exposing dozens of individual tool functions, MemTools provides a **single tool** that accepts shell commands, giving LLMs the full power of the POSIX-like shell.

### Why Use MemTools?

- **Simplicity**: One tool instead of dozens
- **Flexibility**: LLMs can use any command combination (pipes, HEREDOC, redirection)
- **Statefulness**: File system persists across multiple tool calls
- **Multiline Support**: Full HEREDOC support for creating complex files
- **No Hallucination**: LLMs work with a real file system, not imagined files

### Quick Start

```javascript
const { MemTools } = require('@autox/utileejs');

// Create tools instance
const memtools = new MemTools();

// Execute commands
memtools.exec('mkdir project');
memtools.exec('cd project');
memtools.exec(`cat > hello.js << EOF
console.log('Hello from LLM!');
EOF`);
memtools.exec('node hello.js'); // Output: Hello from LLM!

// Get tool definition for your LLM API
const openaiTool = memtools.getOpenAIToolDefinition();
```

### OpenAI Integration

```javascript
const { MemTools } = require('@autox/utileejs');
const OpenAI = require('openai');

const memtools = new MemTools();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
        {
            role: 'system',
            content: 'You are a helpful assistant with access to an in-memory file system.'
        },
        {
            role: 'user',
            content: 'Create a package.json for a new Node.js project called "my-app"'
        }
    ],
    tools: [memtools.getOpenAIToolDefinition()],
    tool_choice: 'auto'
});

// Handle tool call
const toolCall = response.choices[0].message.tool_calls[0];
const args = JSON.parse(toolCall.function.arguments);
const result = memtools.exec(args.command);

console.log('Tool result:', result);
```





### MemTools API

#### Constructor

```javascript
const memtools = new MemTools(fs?)
```

Create a new MemTools instance, optionally with an existing MemFS instance.

#### exec(command)

```javascript
const output = memtools.exec(command: string): string
```

Execute a shell command. Supports all MemShell features including pipes, HEREDOC, and output redirection.

**Examples:**
```javascript
// Basic commands
memtools.exec('ls -l')
memtools.exec('mkdir -p src/components')
memtools.exec('echo "Hello" > file.txt')

// HEREDOC (multiline)
memtools.exec(`cat > config.yml << EOF
server:
  port: 8080
database:
  host: localhost
EOF`)

// Pipes and processing
memtools.exec('cat log.txt | grep ERROR > errors.txt')

// JavaScript execution
memtools.exec(`cat > script.js << EOF
console.log('Test');
EOF`)
memtools.exec('node script.js')
```

#### Tool Definitions

Get tool definitions for different LLM platforms:

```javascript
memtools.getOpenAIToolDefinition()      // OpenAI function calling
memtools.getToolDefinition()            // Generic JSON Schema
```

#### handleToolCall(toolCall)

```javascript
const result = memtools.handleToolCall(toolCall: Object): string
```

Generic handler that works with different tool call formats:

```javascript
// OpenAI format
memtools.handleToolCall({ arguments: { command: 'ls' } })

// Anthropic format
memtools.handleToolCall({ input: { command: 'ls' } })

// Direct format
memtools.handleToolCall({ command: 'ls' })
```

#### State Management

```javascript
// Get current directory
const cwd = memtools.getCwd()

// Reset file system
memtools.reset()

// Export state (for persistence)
const state = memtools.exportState()
// state = { cwd: '/project', root: {...} }

// Import state (restore from JSON)
memtools.importState(state)

// Get underlying MemFS instance
const fs = memtools.getFileSystem()
```

### Real-World Use Cases

#### 1. Code Generation

LLM generates complete project structure:

```javascript
const memtools = new MemTools();

// LLM creates project structure
memtools.exec('mkdir -p src tests docs');

memtools.exec(`cat > package.json << EOF
{
  "name": "my-project",
  "version": "1.0.0",
  "main": "src/index.js"
}
EOF`);

memtools.exec(`cat > src/index.js << EOF
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
EOF`);

// Export project to real filesystem
memtools.exec('export . /path/to/real/project');
```

#### 2. Log Analysis

LLM analyzes and processes server logs:

```javascript
// Import real log file
memtools.exec('import /var/log/server.log');

// LLM filters errors
memtools.exec('cat server.log | grep ERROR > errors.txt');

// LLM counts by error type
memtools.exec('cat errors.txt | sed "s/.*ERROR: //" | sed "s/ -.*//" > error-types.txt');

// LLM generates report
const errors = memtools.exec('cat error-types.txt');
// LLM can now analyze error patterns
```

#### 3. Data Transformation

LLM processes and transforms data:

```javascript
// Import CSV data
memtools.exec('import data.csv');

// LLM filters and transforms
memtools.exec('cat data.csv | grep "2024" | sed "s/,/\\t/g" > 2024-data.tsv');

// LLM generates summary
memtools.exec('cat 2024-data.tsv | sed "s/\\t.*//" > dates.txt');
```

#### 4. Persistent Sessions

Maintain context across multiple LLM conversations:

```javascript
// Conversation 1
const memtools = new MemTools();
memtools.exec('mkdir project');
memtools.exec('cd project');
const state1 = memtools.exportState();

// Save state to database/storage...

// Conversation 2 (later)
const memtools2 = new MemTools();
memtools2.importState(state1);
// File system state restored, LLM can continue where it left off
memtools2.exec('ls'); // Shows files from previous conversation
```

### Examples

See complete working examples:

- **OpenAI Integration**: `examples/llm-tool-openai.js`

Run examples:

```bash
# OpenAI example
node examples/llm-tool-openai.js
```

## API Reference

### MemFS

```javascript
const { MemFS } = require('@autox/utileejs');
const fs = new MemFS();

// File operations
const file = fs.createFile('test.txt', 'content');
file.write('new content');
file.append(' more');
console.log(file.read());

// Directory operations
const dir = fs.createDirectory('mydir');
fs.createDirectories('path/to/nested/dir');

// Navigation
fs.changeDirectory('mydir');
console.log(fs.getCurrentDirectory());

// Path resolution
const node = fs.resolvePath('path/to/file.txt');

// Remove
fs.remove('file.txt');
fs.remove('dir', true); // recursive

// Import/Export
fs.importFile('/real/path/file.txt', 'memory-file.txt');
fs.exportFile('memory-file.txt', '/real/path/output.txt');
fs.importDirectory('/real/dir', 'memory-dir');
fs.exportDirectory('memory-dir', '/real/output');
```

### MemShell

```javascript
const { MemShell } = require('@autox/utileejs');
const shell = new MemShell(); // Uses its own MemFS instance

// Or use existing MemFS
const fs = new MemFS();
const shell = new MemShell(fs);

// Execute commands
const output = shell.exec('ls -l');
console.log(output);

shell.exec('mkdir test');
shell.exec('cd test');
shell.exec('write hello.txt "Hello World"');
console.log(shell.exec('cat hello.txt'));
```

### MemREPL

```javascript
const { MemREPL } = require('@autox/utileejs');
const repl = new MemREPL();

// Start interactive mode
repl.start();

// Execute single command
repl.execCommand('ls -l');

// Execute script
const commands = [
    'mkdir test',
    'cd test',
    'touch file.txt'
];
repl.execScript(commands);
```

## Examples

### Example 1: Create and Execute JavaScript

```bash
$ mkdir projects
$ cd projects
$ write hello.js "console.log('Hello, World!');"
$ node hello.js
Hello, World!
```

### Example 2: Module System

```bash
$ write math.js "module.exports = { add: (a,b) => a+b };"
$ write main.js "const m = require('./math.js'); console.log(m.add(5,3));"
$ node main.js
8
```

### Example 3: Import and Process Files

```bash
$ import /path/to/data.txt
$ grep "error" data.txt
$ sed s/error/warning/g data.txt
$ export data.txt /path/to/output.txt
```

### Example 4: Batch Processing

```javascript
const { MemShell } = require('@autox/utileejs');
const shell = new MemShell();

// Create project structure
shell.exec('mkdir -p src tests docs');
shell.exec('write src/index.js "// Main file"');
shell.exec('write tests/test.js "// Tests"');
shell.exec('write README.md "# My Project"');

// Process files
const files = shell.exec('find . --type f');
console.log('Project files:', files);

// Search across all files
shell.exec('grep -n "TODO" $(find . --name "*.js")');
```

## Development

This project includes a comprehensive Makefile for common development tasks.

### Quick Start for Developers

```bash
# Install dependencies
make install

# Build TypeScript
make build

# Run tests
make test

# Build and run quick tests
make quick

# Full CI pipeline
make ci
```

### Available Make Targets

Run `make help` to see all available targets:

```bash
make help
```

#### Build Commands
- `make build` - Build TypeScript to JavaScript
- `make clean` - Clean build artifacts
- `make rebuild` - Clean and rebuild
- `make watch` - Watch for changes and rebuild

#### Testing Commands
- `make test` - Run all tests
- `make test-unit` - Run unit tests only (*.test.js)
- `make test-all` - Run all tests including test_*.js files
- `make test-watch` - Run tests in watch mode
- `make test-coverage` - Run tests with coverage report

#### Code Quality
- `make check` - Type check without emitting files
- `make lint` - Lint TypeScript files (requires ESLint)
- `make format` - Format code with Prettier (requires Prettier)

#### Development
- `make dev` - Start development mode
- `make repl` - Start memsh REPL
- `make examples` - List available example files

#### Release
- `make version-patch` - Bump patch version (0.0.x)
- `make version-minor` - Bump minor version (0.x.0)
- `make version-major` - Bump major version (x.0.0)
- `make prepublish` - Prepare for publishing (clean, build, test)
- `make publish` - Publish to npm

#### Utilities
- `make info` - Show project information and statistics
- `make verify` - Verify project setup
- `make tree` - Show project structure

#### Quick Commands
- `make all` - Run full build pipeline (clean, install, build, test)
- `make ci` - CI/CD pipeline (clean, build, test)
- `make quick` - Quick build and test

### Project Structure

```
utileejs/
├── bin/              # CLI executables
│   └── memsh
├── examples/         # Example files
│   └── *.js
├── lib/              # Compiled TypeScript output (generated)
│   └── *.js, *.d.ts, *.js.map
├── src/              # TypeScript source files
│   ├── CommandParser.ts
│   ├── EventRouter.ts
│   ├── JSEngine.ts
│   ├── MemFS.ts
│   ├── MemFSAdapter.ts
│   ├── MemREPL.ts
│   ├── MemShell.ts
│   ├── MemTools.ts
│   └── util.ts
├── test/             # All test files
│   ├── *.test.js     # Mocha test suites
│   └── test_*.js     # Additional test files
├── index.js          # Main entry point
├── Makefile          # Build automation
├── package.json      # Package configuration
├── tsconfig.json     # TypeScript configuration
└── README.md         # Documentation
```

## Running Tests

```bash
npm test
# or
make test
```

## Running Examples

```bash
node examples/memfs-example.js
```

## CLI Usage

### Interactive Mode
```bash
memsh
```

### Execute Single Command
```bash
memsh -c "ls -l"
```

### Execute Script File
```bash
memsh script.sh
```

## Use Cases

1. **LLM Integration**: Give AI assistants file system capabilities via function calling
2. **Testing**: Create isolated file system environments for tests
3. **Prototyping**: Quickly experiment with file operations
4. **Sandboxing**: Run code in isolated environment
5. **Education**: Learn shell commands safely
6. **Data Processing**: Manipulate files without touching real filesystem
7. **Build Tools**: Create temporary file structures for build processes
8. **Code Generation**: Let LLMs generate and execute code in safe environment
9. **Agent Systems**: Provide file system access to autonomous agents

## License

EPL-2.0

## Author

Joohwi Lee <telnet2@gmail.com>

## Repository

https://github.com/telnet2/utileejs
