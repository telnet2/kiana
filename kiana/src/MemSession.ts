/**
 * MemSession - Manages session state for MemShell
 * Includes command history, environment variables, and working directory
 */
export class MemSession {
    private id: string;
    private createdAt: Date;
    private history: string[];
    private env: Record<string, string>;
    private workingDirectory: string;
    private maxHistorySize: number;

    constructor(id?: string, maxHistorySize: number = 1000) {
        this.id = id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.createdAt = new Date();
        this.history = [];
        this.env = { ...process.env } as Record<string, string>;
        this.workingDirectory = '/';
        this.maxHistorySize = maxHistorySize;
    }

    /**
     * Get session ID
     */
    getId(): string {
        return this.id;
    }

    /**
     * Get session creation timestamp
     */
    getCreatedAt(): Date {
        return this.createdAt;
    }

    /**
     * Add command to history
     */
    addCommand(command: string): void {
        this.history.push(command);
        // Keep history size manageable
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get command history
     */
    getHistory(): string[] {
        return [...this.history];
    }

    /**
     * Get specific command from history by index (negative index from end)
     */
    getHistoryEntry(index: number): string | undefined {
        if (index >= 0) {
            return this.history[index];
        }
        // Negative index: -1 is last, -2 is second to last, etc.
        return this.history[this.history.length + index];
    }

    /**
     * Clear history
     */
    clearHistory(): void {
        this.history = [];
    }

    /**
     * Get environment variable
     */
    getEnv(key: string): string | undefined {
        return this.env[key];
    }

    /**
     * Set environment variable
     */
    setEnv(key: string, value: string): void {
        this.env[key] = value;
    }

    /**
     * Get all environment variables
     */
    getAllEnv(): Record<string, string> {
        return { ...this.env };
    }

    /**
     * Set multiple environment variables
     */
    setEnvVars(vars: Record<string, string>): void {
        this.env = { ...this.env, ...vars };
    }

    /**
     * Unset environment variable
     */
    unsetEnv(key: string): void {
        delete this.env[key];
    }

    /**
     * Get current working directory
     */
    getCwd(): string {
        return this.workingDirectory;
    }

    /**
     * Set current working directory
     */
    setCwd(path: string): void {
        this.workingDirectory = path;
    }

    /**
     * Get session info
     */
    getInfo(): {
        id: string;
        createdAt: Date;
        historySize: number;
        envVarCount: number;
        cwd: string;
    } {
        return {
            id: this.id,
            createdAt: this.createdAt,
            historySize: this.history.length,
            envVarCount: Object.keys(this.env).length,
            cwd: this.workingDirectory,
        };
    }
}
