import * as readline from 'readline';
import { MemFS } from './MemFS';
import { MemShell } from './MemShell';
import { parseHeredoc } from './CommandParser';

/**
 * REPL (Read-Eval-Print Loop) interface for MemShell
 */
export class MemREPL {
    public shell: MemShell;
    private rl: readline.Interface | null;
    private running: boolean;
    private history: string[];
    private heredocMode: boolean;
    private heredocCommand: string;
    private heredocDelimiter: string;
    private heredocContent: string[];

    constructor(memfs: MemFS | null = null) {
        this.shell = new MemShell(memfs);
        this.rl = null;
        this.running = false;
        this.history = [];
        this.heredocMode = false;
        this.heredocCommand = '';
        this.heredocDelimiter = '';
        this.heredocContent = [];
    }

    /**
     * Get the prompt string
     */
    getPrompt(): string {
        if (this.heredocMode) {
            return '> ';
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

  Search and Manipulation:
    grep [options] <pattern> <file...>  - Search for pattern in files
                                         -i: case insensitive, -n: show line numbers
    find [options] [path]               - Find files in directory hierarchy
                                         --name <pattern>: match name pattern
                                         --type <f|d>: filter by type (file or directory)
    sed <s/pattern/replacement/flags> <file>  - Stream editor (substitute)

  Import/Export:
    import [options] <real-path> [mem-path]  - Import from real filesystem
                                              -r, -R: recursive (for directories)
    export <mem-path> <real-path>           - Export to real filesystem

  Execution:
    node <script.js> [args...]  - Execute JavaScript file in memory filesystem

  Utility:
    echo <text...>             - Display text
    help                       - Show this help message
    exit, quit                 - Exit the shell

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

  Pipes:
  $ cat file.txt | grep "error" | sed s/error/warning/g
  $ ls | grep ".js"

  HEREDOC:
  $ cat << EOF
  > line 1
  > line 2
  > EOF
`;
        console.log(help);
    }

    /**
     * Handle a command
     */
    handleCommand(line: string): void {
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
                return;
            }

            // Add line to heredoc content
            this.heredocContent.push(line);
            return;
        }

        const trimmed = line.trim();

        if (!trimmed) {
            return;
        }

        // Add to history
        this.history.push(trimmed);

        // Handle special commands
        if (trimmed === 'help') {
            this.showHelp();
            return;
        }

        if (trimmed === 'exit' || trimmed === 'quit') {
            this.stop();
            return;
        }

        if (trimmed === 'clear') {
            console.clear();
            return;
        }

        if (trimmed === 'history') {
            this.history.forEach((cmd, i) => {
                console.log(`${i + 1}  ${cmd}`);
            });
            return;
        }

        // Check for HEREDOC
        const heredocInfo = parseHeredoc(trimmed);
        if (heredocInfo) {
            // Enter HEREDOC mode
            this.heredocMode = true;
            this.heredocCommand = heredocInfo.command;
            this.heredocDelimiter = heredocInfo.delimiter;
            this.heredocContent = [];
            return;
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
            this.handleCommand(line);
            if (this.running && this.rl) {
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
