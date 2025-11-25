import { MemShell } from './MemShell';
import { MemFS, MemNode, MemFile, MemDirectory } from './MemFS';

/**
 * OpenAI tool definition
 */
export interface OpenAIToolDefinition {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                [key: string]: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
}

/**
 * Anthropic tool definition
 */
export interface AnthropicToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: string;
        properties: {
            [key: string]: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
}

/**
 * MCP (Model Context Protocol) tool definition
 */
export interface MCPToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            [key: string]: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
}

/**
 * Generic tool definition
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            [key: string]: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
}

/**
 * Tool call from LLM
 */
export interface ToolCall {
    command?: string;
    parameters?: {
        command?: string;
    };
    input?: {
        command?: string;
    };
    arguments?: {
        command?: string;
    };
}

/**
 * Serialized node structure
 */
interface SerializedNode {
    type: 'file' | 'directory';
    name: string;
    content?: string;
    children?: SerializedNode[];
    createdAt: Date;
    modifiedAt: Date;
}

/**
 * File system state
 */
export interface FileSystemState {
    cwd: string;
    root: SerializedNode;
}

/**
 * MemTools - LLM Tool Interface for In-Memory File System
 *
 * Provides a single tool interface for LLMs to interact with an in-memory
 * file system using shell commands. Maintains state across multiple calls.
 *
 * Usage with LLM function calling:
 * 1. Create an instance: const tools = new MemTools()
 * 2. Get tool definition: tools.getToolDefinition()
 * 3. Execute commands: tools.exec(command)
 */
export class MemTools {
    private shell: MemShell;
    public fs: MemFS;

    /**
     * Create a new MemTools instance
     * @param fs - Optional existing MemFS instance
     */
    constructor(fs?: MemFS) {
        this.shell = new MemShell(fs);
        this.fs = this.shell.fs;
    }

    /**
     * Execute a shell command in the in-memory file system
     *
     * Supports all shell features:
     * - File operations: ls, cat, mkdir, touch, rm, write
     * - Search: grep, find, sed
     * - Pipes: cmd1 | cmd2 | cmd3
     * - HEREDOC: cat > file.txt << EOF\ncontents\nEOF
     * - Output redirection: echo text > file.txt
     * - JavaScript execution: node script.js
     * - Import/Export: import /path/file.txt, export file.txt /path/output.txt
     *
     * @param command - Shell command to execute (can be multiline)
     * @returns Command output
     * @throws Error if command fails
     */
    exec(command: string): string {
        try {
            return this.shell.exec(command);
        } catch (error: any) {
            throw new Error(`Command failed: ${error.message}`);
        }
    }

    /**
     * Get OpenAI-compatible tool definition
     * @returns OpenAI function calling schema
     */
    getOpenAIToolDefinition(): OpenAIToolDefinition {
        return {
            type: "function",
            function: {
                name: "memfs_exec",
                description: "Execute shell commands in an in-memory file system. Supports all POSIX-like commands including ls, cat, grep, find, jqn, wc, curl, node, pipes, HEREDOC, and output redirection. State persists across calls.",
                parameters: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            description: "Shell command to execute. Can be multiline for HEREDOC (e.g., 'cat > file.txt << EOF\\nline 1\\nline 2\\nEOF'). Examples:\n- List files: 'ls -l'\n- Read file: 'cat file.txt'\n- Create file: 'echo Hello > hello.txt'\n- Search: 'grep error log.txt' or 'find . -name \"*.txt\"'\n- Count: 'wc -l file.txt' or 'ls | wc -l'\n- JSON query: 'echo '{\"name\":\"John\"}' | jqn .name'\n- HTTP request: 'curl http://example.com' or 'curl -X POST -d \"data\" http://api.example.com'\n- Pipe: 'cat file.txt | grep pattern'\n- HEREDOC: 'cat > config.yml << EOF\\nkey: value\\nEOF'\n- Execute JS: 'node script.js'"
                        }
                    },
                    required: ["command"]
                }
            }
        };
    }

    /**
     * Get Anthropic-compatible tool definition
     * @returns Anthropic tool schema
     */
    getAnthropicToolDefinition(): AnthropicToolDefinition {
        return {
            name: "memfs_exec",
            description: "Execute shell commands in an in-memory file system. Supports all POSIX-like commands including ls, cat, grep, find, jqn, wc, curl, node, pipes, HEREDOC, and output redirection. State persists across calls, allowing you to create files, directories, query JSON, make HTTP requests, and execute JavaScript in the memory filesystem.",
            input_schema: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "Shell command to execute. Can be multiline for HEREDOC (e.g., 'cat > file.txt << EOF\\nline 1\\nline 2\\nEOF'). Supports:\n- Navigation: ls, cd, pwd\n- File ops: cat, touch, rm, mkdir, write\n- Search: grep, find, sed\n- Counting: wc (word, line, byte counts)\n- JSON: jqn (JSON queries with jq syntax)\n- Network: curl (HTTP requests with headers, data, auth)\n- Pipes: cmd1 | cmd2\n- Redirection: echo text > file.txt\n- HEREDOC: cat > file << EOF\\ncontent\\nEOF\n- Execute: node script.js\n- Import/Export: import /real/path, export file /real/path"
                    }
                },
                required: ["command"]
            }
        };
    }

    /**
     * Get MCP (Model Context Protocol) compatible tool definition
     * @returns MCP tool schema
     */
    getMCPToolDefinition(): MCPToolDefinition {
        return {
            name: "memfs_exec",
            description: "Execute shell commands in an in-memory file system. Supports ls, cat, grep, find, jqn (JSON), wc (word count), curl (HTTP requests), node (JavaScript), pipes, HEREDOC, and output redirection.",
            inputSchema: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "Shell command to execute. Examples: 'ls -l', 'cat file.txt', 'wc -l file.txt', 'echo data | jqn .field', 'curl http://example.com', 'node script.js' (supports multiline for HEREDOC)"
                    }
                },
                required: ["command"]
            }
        };
    }

    /**
     * Get generic JSON Schema tool definition
     * @returns JSON Schema compatible definition
     */
    getToolDefinition(): ToolDefinition {
        return {
            name: "memfs_exec",
            description: "Execute shell commands in an in-memory file system. Supports ls, cat, grep, find, jqn, wc, curl, node, pipes, HEREDOC, and output redirection. State persists across calls.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "Shell command to execute. Can be multiline. Examples: 'ls -l', 'cat file.txt', 'wc -l', 'echo data | jqn .field', 'curl http://example.com', 'node script.js'"
                    }
                },
                required: ["command"]
            }
        };
    }

    /**
     * Handle tool call from LLM
     * @param toolCall - Tool call object from LLM
     * @returns Command output
     */
    handleToolCall(toolCall: ToolCall): string {
        // Support various tool call formats
        const command = toolCall.command ||
                       toolCall.parameters?.command ||
                       toolCall.input?.command ||
                       toolCall.arguments?.command;

        if (!command) {
            throw new Error('Missing command parameter');
        }

        return this.exec(command);
    }

    /**
     * Get current working directory
     * @returns Current directory path
     */
    getCwd(): string {
        return this.fs.getCurrentDirectory();
    }

    /**
     * Reset file system to empty state and clear session history
     */
    reset(): void {
        this.fs = new MemFS();
        this.shell = new MemShell(this.fs);
    }

    /**
     * Get session from shell
     */
    getSession() {
        return this.shell.session;
    }

    /**
     * Get file system instance (for advanced usage)
     * @returns The underlying MemFS instance
     */
    getFileSystem(): MemFS {
        return this.fs;
    }

    /**
     * Export entire file system state as JSON
     * @returns Serializable file system state
     */
    exportState(): FileSystemState {
        const serializeNode = (node: MemNode): SerializedNode => {
            if (node.isFile()) {
                return {
                    type: 'file',
                    name: node.name,
                    content: node.read(),
                    createdAt: node.createdAt,
                    modifiedAt: node.modifiedAt
                };
            } else if (node.isDirectory()) {
                return {
                    type: 'directory',
                    name: node.name,
                    children: Array.from(node.children.values()).map(serializeNode),
                    createdAt: node.createdAt,
                    modifiedAt: node.modifiedAt
                };
            } else {
                // Fallback case (should never happen)
                return {
                    type: 'directory',
                    name: node.name,
                    children: [],
                    createdAt: node.createdAt,
                    modifiedAt: node.modifiedAt
                };
            }
        };

        return {
            cwd: this.getCwd(),
            root: serializeNode(this.fs.root)
        };
    }

    /**
     * Import file system state from JSON
     * @param state - File system state from exportState()
     */
    importState(state: FileSystemState): void {
        this.reset();

        const deserializeNode = (nodeData: SerializedNode, parent: string | null): void => {
            if (nodeData.type === 'file') {
                const path = parent ? `${parent}/${nodeData.name}` : nodeData.name;
                this.fs.createFile(path, nodeData.content || '');
            } else if (nodeData.type === 'directory' && nodeData.name !== '') {
                const path = parent ? `${parent}/${nodeData.name}` : nodeData.name;
                this.fs.createDirectory(path);
                if (nodeData.children) {
                    for (const child of nodeData.children) {
                        deserializeNode(child, path);
                    }
                }
            } else if (nodeData.type === 'directory' && nodeData.name === '') {
                // Root directory
                if (nodeData.children) {
                    for (const child of nodeData.children) {
                        deserializeNode(child, '');
                    }
                }
            }
        };

        deserializeNode(state.root, null);
        if (state.cwd && state.cwd !== '/') {
            this.fs.changeDirectory(state.cwd);
        }
    }
}
