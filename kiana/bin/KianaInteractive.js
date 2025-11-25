"use strict";
/**
 * KianaInteractive - Interactive conversational mode for Kiana
 *
 * Wraps KianaAgent for interactive REPL use with streaming output.
 * Integrates with session management and shell REPL for seamless switching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KianaInteractive = void 0;
const MemTools_1 = require("./MemTools");
const Writer_1 = require("./Writer");
const ai_1 = require("ai");
const KianaAgentV6_1 = require("./KianaAgentV6");
const dotenv = require("dotenv");
/**
 * Interactive Kiana mode for conversational shell interaction
 */
class KianaInteractive {
    constructor(shell, options) {
        this.agent = null;
        // Load environment variables
        dotenv.config();
        this.shell = shell;
        this.memtools = new MemTools_1.MemTools(shell.fs);
        this.writer = options?.writer || new Writer_1.StdoutWriter();
        this.state = {
            active: true,
            messageCount: 0,
            conversationOpen: false,
            verbose: false,
        };
        this.systemPrompt = options?.systemPrompt || KianaAgentV6_1.DEFAULT_SYSTEM_PROMPT;
        this.model = options?.model || 'doubao-pro-32k';
        this.maxRounds = options?.maxRounds || 20;
        // Configure ARK by default, fallback to OpenAI if arkConfig provided or ARK env vars available
        if (this.state.verbose) {
            console.error(`[KianaInteractive] process.env.ARK_API_KEY:`, process.env.ARK_API_KEY ? 'exists' : 'missing');
            console.error(`[KianaInteractive] process.env.ARK_MODEL_ID:`, process.env.ARK_MODEL_ID ? process.env.ARK_MODEL_ID : 'missing');
        }
        if (options?.arkConfig) {
            this.arkConfig = options.arkConfig;
        }
        else if (process.env.ARK_API_KEY) {
            const modelId = process.env.ARK_MODEL_ID || this.model;
            if (this.state.verbose) {
                console.error(`[KianaInteractive] Using ARK model from env: ${modelId}`);
            }
            this.arkConfig = {
                modelId: modelId,
                apiKey: process.env.ARK_API_KEY,
                baseURL: process.env.ARK_BASE_URL || 'https://ark-ap-southeast.byteintl.net/api/v3'
            };
        }
        else if (options?.apiKey || process.env.OPENAI_API_KEY) {
            // Legacy OpenAI support - will be mapped to ARK config in V6
            this.arkConfig = undefined;
        }
        else {
            // Default to ARK configuration if no API keys provided
            const modelId = process.env.ARK_MODEL_ID || this.model;
            if (this.state.verbose) {
                console.error(`[KianaInteractive] Using default ARK model: ${modelId}`);
            }
            this.arkConfig = {
                modelId: modelId,
                apiKey: process.env.ARK_API_KEY || '',
                baseURL: process.env.ARK_BASE_URL || 'https://ark-ap-southeast.byteintl.net/api/v3'
            };
        }
    }
    /**
     * Get the prompt for this mode
     */
    getPrompt() {
        const cwd = this.shell.fs.getCurrentDirectory();
        return `kiana:${cwd}> `;
    }
    /**
     * Check if interactive mode is active
     */
    isActive() {
        return this.state.active;
    }
    /**
     * Toggle verbose mode
     */
    toggleVerbose() {
        this.state.verbose = !this.state.verbose;
        return this.state.verbose;
    }
    /**
     * Get verbose mode status
     */
    isVerbose() {
        return this.state.verbose;
    }
    /**
     * Send a message to Kiana and get a response
     */
    async sendMessage(message, customWriter) {
        const writer = customWriter || this.writer;
        this.state.messageCount++;
        // Add to session history
        this.shell.session.addCommand(`kiana: ${message}`);
        const prompt = message.trim();
        if (this.state.verbose) {
            console.error(`[KianaInteractive] Sending message: ${prompt}`);
            console.error(`[KianaInteractive] ARK Config:`, this.arkConfig);
        }
        try {
            // Lazily create the agent once per interactive session
            if (!this.agent) {
                if (this.state.verbose) {
                    console.error(`[KianaInteractive] Creating agent with config:`, this.arkConfig);
                }
                this.agent = await (0, KianaAgentV6_1.createKianaAgent)(this.memtools, {
                    systemPrompt: this.systemPrompt,
                    arkConfig: this.arkConfig,
                    maxRounds: this.maxRounds,
                    verbose: this.state.verbose,
                });
            }
            const messages = [
                { id: `u-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: prompt }] },
            ];
            if (this.state.verbose) {
                console.error(`[KianaInteractive] Creating stream with messages:`, messages);
            }
            // Stream UI messages
            const stream = await (0, ai_1.createAgentUIStream)({ agent: this.agent, messages });
            for await (const m of stream) {
                if (this.state.verbose) {
                    console.error(`[KianaInteractive] Stream message:`, m);
                }
                // Handle different message types from the stream
                if (m.type === 'text-delta' && m.delta) {
                    writer.write(m.delta);
                }
                else if (m.type === 'tool-result' && m.result) {
                    const name = m.toolName || 'unknown';
                    const out = typeof m.result === 'string' ? m.result : JSON.stringify(m.result);
                    writer.writeLine(`\n[tool ${name}] ${out}`);
                }
                else if (m.type === 'tool-error' && m.error) {
                    const name = m.toolName || 'unknown';
                    writer.writeLine(`\n[tool ${name} error] ${m.error}`);
                }
            }
            writer.write('\n');
        }
        catch (err) {
            writer.writeLine(`\nError: ${err.message}`);
            if (this.state.verbose) {
                writer.writeLine(`[debug] Full error: ${err.stack || err}`);
            }
        }
    }
    /**
     * Exit interactive mode
     */
    exit() {
        this.state.active = false;
        this.writer.writeLine('[Exiting Kiana Interactive Mode]');
    }
    /**
     * Get session from shell
     */
    getSession() {
        return this.shell.session;
    }
    /**
     * Get shell instance
     */
    getShell() {
        return this.shell;
    }
}
exports.KianaInteractive = KianaInteractive;
