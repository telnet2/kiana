"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemSession = void 0;
/**
 * MemSession - Manages session state for MemShell
 * Includes command history, environment variables, and working directory
 */
class MemSession {
    constructor(id, maxHistorySize = 1000) {
        this.id = id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.createdAt = new Date();
        this.history = [];
        this.env = { ...process.env };
        this.workingDirectory = '/';
        this.maxHistorySize = maxHistorySize;
    }
    /**
     * Get session ID
     */
    getId() {
        return this.id;
    }
    /**
     * Get session creation timestamp
     */
    getCreatedAt() {
        return this.createdAt;
    }
    /**
     * Add command to history
     */
    addCommand(command) {
        this.history.push(command);
        // Keep history size manageable
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }
    /**
     * Get command history
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Get specific command from history by index (negative index from end)
     */
    getHistoryEntry(index) {
        if (index >= 0) {
            return this.history[index];
        }
        // Negative index: -1 is last, -2 is second to last, etc.
        return this.history[this.history.length + index];
    }
    /**
     * Clear history
     */
    clearHistory() {
        this.history = [];
    }
    /**
     * Get environment variable
     */
    getEnv(key) {
        return this.env[key];
    }
    /**
     * Set environment variable
     */
    setEnv(key, value) {
        this.env[key] = value;
    }
    /**
     * Get all environment variables
     */
    getAllEnv() {
        return { ...this.env };
    }
    /**
     * Set multiple environment variables
     */
    setEnvVars(vars) {
        this.env = { ...this.env, ...vars };
    }
    /**
     * Unset environment variable
     */
    unsetEnv(key) {
        delete this.env[key];
    }
    /**
     * Get current working directory
     */
    getCwd() {
        return this.workingDirectory;
    }
    /**
     * Set current working directory
     */
    setCwd(path) {
        this.workingDirectory = path;
    }
    /**
     * Get session info
     */
    getInfo() {
        return {
            id: this.id,
            createdAt: this.createdAt,
            historySize: this.history.length,
            envVarCount: Object.keys(this.env).length,
            cwd: this.workingDirectory,
        };
    }
}
exports.MemSession = MemSession;
