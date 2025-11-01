/**
 * KianaInteractive - Interactive conversational mode for Kiana
 *
 * Wraps KianaAgent for interactive REPL use with streaming output.
 * Integrates with session management and shell REPL for seamless switching.
 */

import { MemShell } from './MemShell';
import { MemTools } from './MemTools';
import { Writer, StdoutWriter } from './Writer';
import { runKiana, DEFAULT_SYSTEM_PROMPT } from './KianaAgent';

/**
 * Tracks state of an interactive Kiana session
 */
interface InteractiveState {
    active: boolean;
    messageCount: number;
    conversationOpen: boolean;
    verbose: boolean;
}

/**
 * Interactive Kiana mode for conversational shell interaction
 */
export class KianaInteractive {
    private shell: MemShell;
    private memtools: MemTools;
    private writer: Writer;
    private state: InteractiveState;
    private systemPrompt: string;
    private model: string;
    private maxRounds: number;
    private apiKey: string;

    constructor(
        shell: MemShell,
        options?: {
            writer?: Writer;
            systemPrompt?: string;
            model?: string;
            maxRounds?: number;
            apiKey?: string;
        }
    ) {
        this.shell = shell;
        this.memtools = new MemTools(shell.fs);
        this.writer = options?.writer || new StdoutWriter();
        this.state = {
            active: true,
            messageCount: 0,
            conversationOpen: false,
            verbose: false,
        };
        this.systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        this.model = options?.model || 'gpt-4o-mini';
        this.maxRounds = options?.maxRounds || 20;
        this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || '';
    }

    /**
     * Get the prompt for this mode
     */
    getPrompt(): string {
        const cwd = this.shell.fs.getCurrentDirectory();
        return `kiana:${cwd}> `;
    }

    /**
     * Check if interactive mode is active
     */
    isActive(): boolean {
        return this.state.active;
    }

    /**
     * Toggle verbose mode
     */
    toggleVerbose(): boolean {
        this.state.verbose = !this.state.verbose;
        return this.state.verbose;
    }

    /**
     * Get verbose mode status
     */
    isVerbose(): boolean {
        return this.state.verbose;
    }

    /**
     * Send a message to Kiana and get a response
     */
    async sendMessage(message: string, customWriter?: Writer): Promise<void> {
        const writer = customWriter || this.writer;
        this.state.messageCount++;

        // Add to session history
        this.shell.session.addCommand(`kiana: ${message}`);

        // Format the instruction
        const instruction = message.trim();

        try {
            // Call runKiana with the message
            await runKiana(
                {
                    instruction,
                    systemPrompt: this.systemPrompt,
                    model: this.model,
                    maxRounds: this.maxRounds,
                    apiKey: this.apiKey,
                    verbose: this.state.verbose,
                },
                this.memtools,
                writer
            );

            writer.write('\n');
        } catch (err: any) {
            writer.writeLine(`\nError: ${err.message}`);
        }
    }

    /**
     * Exit interactive mode
     */
    exit(): void {
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
    getShell(): MemShell {
        return this.shell;
    }
}
