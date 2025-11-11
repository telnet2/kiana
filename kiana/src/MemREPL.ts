import * as readline from 'readline';
import { MemFS } from './MemFS';
import { MemShell } from './MemShell';
import { MemSession } from './MemSession';
import { KianaInteractive } from './KianaInteractive';
import { StdoutWriter, SpinnerWriter } from './Writer';
import { Spinner } from './Spinner';
import { parseHeredoc } from './CommandParser';
import { ARKConfig } from './KianaAgentV6';

/**
 * REPL (Read-Eval-Print Loop) interface for MemShell
 */
export class MemREPL {
    public shell: MemShell;
    private rl: readline.Interface | null;
    private running: boolean;
    private heredocMode: boolean;
    private heredocCommand: string;
    private heredocDelimiter: string;
    private heredocContent: string[];
    private kianaMode: boolean;
    private kiana: KianaInteractive | null;
    private arkConfig: ARKConfig | undefined;

    constructor(memfs: MemFS | null = null, session: MemSession | null = null, arkConfig?: ARKConfig) {
        this.shell = new MemShell(memfs, session);
        this.rl = null;
        this.running = false;
        this.heredocMode = false;
        this.heredocCommand = '';
        this.heredocDelimiter = '';
        this.heredocContent = [];
        this.kianaMode = false;
        this.kiana = null;
        this.arkConfig = arkConfig;
    }

    /**
     * Get the prompt string
     */
    getPrompt(): string {
        if (this.heredocMode) {
            return '> ';
        }
        if (this.kianaMode && this.kiana) {
            return this.kiana.getPrompt();
        }
        const cwd = this.shell.fs.getCurrentDirectory();
        return `memsh:${cwd}$ `;
    }

    /**
     * Display help information
     */
    showHelp(): void {
        const help = `
MemShell - In-Memory File System Shell

Available Commands:
  File System Navigation:
    ls [options] [path]        - List directory contents
                                 -l: long format, -a: show all (including . and ..)
    cd [path]                  - Change directory
    pwd                        - Print working directory

  File Operations:
    cat <file...>              - Display file contents
    touch <file...>            - Create empty file or update timestamp
    mkdir [options] <dir...>   - Create directory
                                 -p: create parent directories as needed
    rm [options] <path...>     - Remove files or directories
                                 -r, -R: recursive removal
    write <file> <content>     - Write content to file
    vim <file>                 - Edit file interactively with vim

  Search and Manipulation:
    grep [options] <pattern> <file...>  - Search for pattern in files
                                         -i: case insensitive, -n: show line numbers
    find [options] [path]               - Find files in directory hierarchy
                                         --name <pattern>: match name pattern
                                         --type <f|d>: filter by type (file or directory)
    sed <s/pattern/replacement/flags> <file>  - Stream editor (substitute)
    jqn [options] [filter] [file]       - JSON query processor using jq syntax
                                         -r: raw output, -c: compact output
                                         -s: slurp mode, -n: null input
    wc [options] [file]                 - Count lines, words, and characters
                                         -l: lines, -w: words, -c: bytes

  Import/Export:
    import [options] <real-path> [mem-path]  - Import from real filesystem
                                              -r, -R: recursive (for directories)
                                              Supports wildcards: *.md, *.txt, etc.
    export <mem-path> <real-path>           - Export to real filesystem
                                              Supports wildcards: *.md, *.txt, etc.

  Execution:
    node <script.js> [args...]  - Execute JavaScript file in memory filesystem

  Network:
    curl [options] <url>                      - Download/upload data using URLs
                                               -X: HTTP method, -H: headers
                                               -d: data, -o: save to file

  Interactive AI Agent:
    kiana                      - Enter Kiana interactive mode (conversational AI)

  Utility:
    echo <text...>             - Display text
    help                       - Show this help message
    exit, quit                 - Exit the shell
    clear                      - Clear screen
    history                    - Show command history

  Advanced Features:
    Pipes (|)                  - Chain commands together
    HEREDOC (<<)               - Multi-line input

Examples:
  $ mkdir -p projects/myapp
  $ cd projects/myapp
  $ write hello.js "console.log('Hello, World!');"
  $ node hello.js
  $ grep -n "Hello" hello.js
  $ find . --name "*.js"
  $ import -r /path/to/real/dir mydir
  $ export mydir /path/to/export
  $ import *.md docs/     # Import all markdown files to docs/ directory
  $ import src/*.js ./    # Import all JS files from src/ to current directory
  $ export *.md output/   # Export all markdown files to output/ directory
  $ export src/*.js backup/ # Export all JS files from src/ to backup/

  JSON Processing:
  $ echo '{"name":"John","age":30}' | jqn .name
  $ jqn '.[] | select(.age > 18)' users.json
  $ jqn -r '.email' << EOF
  > {"name":"Alice","email":"alice@example.com"}
  > EOF

  HTTP Requests:
  $ curl http://example.com
  $ curl -X POST -d "key=value" http://api.example.com
  $ curl -H "Content-Type: application/json" -d @data.json http://example.com/api

  Pipes:
  $ cat file.txt | grep "error" | sed s/error/warning/g
  $ ls | grep ".js"
  $ jqn '.[].name' data.json | grep "John"

  HEREDOC:
  $ cat << EOF
  > line 1
  > line 2
  > EOF

  Kiana Interactive Mode:
  $ kiana
  [Entering Kiana Interactive Mode]
  Commands:
    /exit               - Return to shell mode
    /verbose            - Toggle verbose output (show tool calls and LLM details)
  
  kiana:/$ Create a TypeScript project with tests
  🔧 memfs_exec: mkdir -p /project/{src,tests}
  ✓ Result: Created directories
  
  Kiana: I've created a TypeScript project structure...
  
  kiana:/$ /verbose
  [Verbose mode: ON]
  
  kiana:/$ /exit
  [Returning to Shell Mode]
  memsh:/$
`;
        console.log(help);
    }

    /**
     * Handle a command
     * Returns true if should auto-prompt, false if async and will prompt manually
     */
    handleCommand(line: string): boolean {
        // If in HEREDOC mode, collect content
        if (this.heredocMode) {
            const trimmed = line.trim();

            // Check if this is the delimiter
            if (trimmed === this.heredocDelimiter) {
                // End of HEREDOC - execute command
                this.heredocMode = false;
                const content = this.heredocContent.join('\n');
                const fullCommand = `${this.heredocCommand} << ${this.heredocDelimiter}\n${content}\n${this.heredocDelimiter}`;

                try {
                    const result = this.shell.execWithHeredoc(this.heredocCommand, content);
                    if (result) {
                        console.log(result);
                    }
                } catch (err: any) {
                    console.error(err.message);
                }

                // Reset heredoc state
                this.heredocCommand = '';
                this.heredocDelimiter = '';
                this.heredocContent = [];
                return true; // Auto-prompt
            }

            // Add line to heredoc content
            this.heredocContent.push(line);
            return true; // Auto-prompt
        }

        const trimmed = line.trim();

        if (!trimmed) {
            return true; // Auto-prompt
        }

        // Handle Kiana-specific commands
        if (this.kianaMode && this.kiana) {
            if (trimmed === '/exit') {
                this.kianaMode = false;
                console.log('[Returning to Shell Mode]');
                return true; // Auto-prompt
            }

            if (trimmed === '/verbose') {
                const isVerbose = this.kiana.toggleVerbose();
                console.log(`[Verbose mode: ${isVerbose ? 'ON' : 'OFF'}]`);
                return true; // Auto-prompt
            }

            // Send to Kiana LLM with spinner
            (async () => {
                const spinner = new Spinner();
                try {
                    // Show spinner while waiting for first response
                    spinner.start();
                    
                    // Wrap writer to stop spinner on first output
                    const baseWriter = new StdoutWriter();
                    const spinnerWriter = new SpinnerWriter(baseWriter, spinner);
                    
                    await this.kiana!.sendMessage(trimmed, spinnerWriter);
                    
                    // Ensure spinner is stopped
                    if (spinner.isRunning()) {
                        spinner.stop();
                    }
                    
                    // Re-prompt after message completes
                    if (this.running && this.rl && this.kianaMode) {
                        console.log(); // New line after streaming content
                        this.rl.setPrompt(this.getPrompt());
                        this.rl.prompt();
                    }
                } catch (err: any) {
                    // Ensure spinner is stopped on error
                    if (spinner.isRunning()) {
                        spinner.stop();
                    }
                    console.error(`\nError: ${err.message}`);
                    // Re-prompt on error too
                    if (this.running && this.rl && this.kianaMode) {
                        this.rl.setPrompt(this.getPrompt());
                        this.rl.prompt();
                    }
                }
            })();
            return false; // Don't auto-prompt, async handler will prompt
        }

        // Add to history (only in shell mode)
        this.shell.session.addCommand(trimmed);

        // Handle special commands
        if (trimmed === 'help') {
            this.showHelp();
            return true; // Auto-prompt
        }

        if (trimmed === 'kiana') {
            this.enterKianaMode();
            return true; // Auto-prompt
        }

        if (trimmed === 'exit' || trimmed === 'quit') {
            this.stop();
            return true; // Auto-prompt (though process exits)
        }

        if (trimmed === 'clear') {
            console.clear();
            return true; // Auto-prompt
        }

        if (trimmed === 'history') {
            const history = this.shell.session.getHistory();
            history.forEach((cmd, i) => {
                console.log(`${i + 1}  ${cmd}`);
            });
            return true; // Auto-prompt
        }

        // Check for HEREDOC
        const heredocInfo = parseHeredoc(trimmed);
        if (heredocInfo) {
            // Enter HEREDOC mode
            this.heredocMode = true;
            this.heredocCommand = heredocInfo.command;
            this.heredocDelimiter = heredocInfo.delimiter;
            this.heredocContent = [];
            return true; // Auto-prompt
        }

        // Execute command through shell
        try {
            const result = this.shell.exec(trimmed);
            if (result) {
                console.log(result);
            }
        } catch (err: any) {
            console.error(err.message);
        }

        return true; // Auto-prompt
    }

    /**
     * Start the REPL
     */
    start(): void {
        this.running = true;

        console.log('MemShell - In-Memory File System Shell');
        console.log('Type "help" for available commands, "exit" to quit\n');

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
        });

        this.rl.on('line', (line: string) => {
            const shouldAutoPrompt = this.handleCommand(line);
            // Only auto-prompt if command indicates it should
            // (Kiana mode async operations will prompt manually after completion)
            if (shouldAutoPrompt && this.running && this.rl) {
                this.rl.setPrompt(this.getPrompt());
                this.rl.prompt();
            }
        });

        this.rl.on('close', () => {
            this.stop();
        });

        this.rl.prompt();
    }

    /**
     * Stop the REPL
     */
    stop(): void {
        this.running = false;
        if (this.rl) {
            this.rl.close();
        }
        console.log('\nGoodbye!');
        process.exit(0);
    }

    /**
     * Enter Kiana interactive mode
     */
    private enterKianaMode(): void {
        this.kianaMode = true;
        this.kiana = new KianaInteractive(this.shell, {
            writer: new StdoutWriter(),
            arkConfig: this.arkConfig,
        });
        console.log('[Entering Kiana Interactive Mode]');
        console.log('Type /exit to return to shell mode\n');
    }

    /**
     * Execute a single command (non-interactive mode)
     */
    execCommand(commandLine: string): number {
        try {
            const result = this.shell.exec(commandLine);
            if (result) {
                console.log(result);
            }
            return 0;
        } catch (err: any) {
            console.error(err.message);
            return 1;
        }
    }

    /**
     * Execute multiple commands from a script
     */
    execScript(commands: string[]): number {
        for (const command of commands) {
            const trimmed = command.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                try {
                    const result = this.shell.exec(trimmed);
                    if (result) {
                        console.log(result);
                    }
                } catch (err: any) {
                    console.error(`Error executing '${trimmed}': ${err.message}`);
                    return 1;
                }
            }
        }
        return 0;
    }
}
