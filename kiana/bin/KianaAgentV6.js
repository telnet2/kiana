"use strict";
/**
 * Kiana Agent - AI SDK v6 Implementation
 *
 * Modern implementation using AI SDK v6 with ToolLoopAgent for better
 * performance, maintainability, and ARK OpenAI compatible model support.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKianaAgent = exports.DEFAULT_SYSTEM_PROMPT = void 0;
exports.runKianaV6 = runKianaV6;
exports.runKiana = runKiana;
const ai_1 = require("ai");
const openai_compatible_1 = require("@ai-sdk/openai-compatible");
const zod_1 = require("zod");
/**
 * Default system prompt for Kiana agent
 * (Preserved from original implementation)
 */
exports.DEFAULT_SYSTEM_PROMPT = `You are Kiana, an expert software engineer with access to an in-memory filesystem.

You have access to the memfs_exec tool which executes shell commands in the in-memory filesystem.

Available commands:
- File operations: ls, cat, touch, rm, write
- Directory operations: pwd, cd, mkdir
- Text processing: echo, grep, sed, diff, patch, find, jqn, wc
- Utilities: date, man
- JSON processing: jqn (JSON query with jq syntax)
- Network: curl (transfer data using URLs)
- I/O: import, export (between MemFS and real filesystem)
- Execution: node (sandboxed JavaScript execution)

The filesystem supports:
- Pipelines: cmd1 | cmd2
- Redirections: cmd > file, cmd >> file, cmd << EOF
- Operators: cmd1 && cmd2, cmd1 || cmd2, cmd1 ; cmd2
- Wildcards: *.txt, file?.js
- Command substitution: $(command) - replaces with command output

Useful patterns:
- Count files: ls | wc -l
- Query JSON: echo '{"name":"John"}' | jqn .name
- Make HTTP requests: curl http://example.com or curl -X POST -d "data" http://api.example.com
- Complex filtering: grep pattern file.txt | wc -l

Best practices:
1. Use 'ls' and 'cat' to verify your work
2. Break complex tasks into steps
3. Check command output before proceeding
4. Use command substitution for dynamic values: echo "Today is $(date)"
5. Use pipes to chain operations efficiently
6. Use 'man <command>' or '<command> --help' to see detailed command documentation
7. Provide a summary when complete

When you finish the task, provide a clear summary of what you accomplished.`;
/**
 * Create ARK OpenAI-compatible provider
 */
const createARKProvider = (config) => {
    return (0, openai_compatible_1.createOpenAICompatible)({
        baseURL: config.baseURL,
        name: 'ark',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
        },
    });
};
/**
 * Convert MemTools to ai-sdk tool format
 */
const createMemfsTool = (memtools) => (0, ai_1.tool)({
    description: 'Execute shell commands in the in-memory filesystem',
    inputSchema: zod_1.z.object({
        command: zod_1.z.string().describe('The shell command to execute'),
    }),
    outputSchema: zod_1.z.object({
        result: zod_1.z.string(),
        success: zod_1.z.boolean(),
    }),
    execute: async ({ command }) => {
        try {
            const result = memtools.exec(command);
            return { result, success: true };
        }
        catch (error) {
            return {
                result: `ERROR: ${error instanceof Error ? error.message : String(error)}`,
                success: false
            };
        }
    },
});
/**
 * Create Kiana agent with AI SDK v6
 */
const createKianaAgent = async (memtools, options) => {
    // Validate required options
    if (!options.instruction) {
        throw new Error('Instruction is required');
    }
    const verbose = options.verbose || false;
    const systemPrompt = options.systemPrompt || exports.DEFAULT_SYSTEM_PROMPT;
    const maxRounds = options.maxRounds || 20;
    // Setup model provider
    let model;
    if (options.arkConfig) {
        if (verbose) {
            console.log(`[Kiana] Using ARK model: ${options.arkConfig.modelId}`);
            console.log(`[Kiana] ARK Base URL: ${options.arkConfig.baseURL}`);
        }
        const ark = createARKProvider(options.arkConfig);
        model = ark.chatModel(options.arkConfig.modelId);
    }
    else {
        // Fallback to OpenAI
        if (verbose) {
            console.log(`[Kiana] Using OpenAI model: ${options.model || 'gpt-4o-mini'}`);
        }
        const { openai } = await Promise.resolve().then(() => require('@ai-sdk/openai'));
        model = openai(options.model || 'gpt-4o-mini');
    }
    if (verbose) {
        console.log(`[Kiana] Creating ToolLoopAgent with maxRounds: ${maxRounds}`);
    }
    return new ai_1.ToolLoopAgent({
        model,
        instructions: systemPrompt,
        tools: {
            memfs_exec: createMemfsTool(memtools),
        },
        stopWhen: (0, ai_1.stepCountIs)(maxRounds),
    });
};
exports.createKianaAgent = createKianaAgent;
/**
 * Run Kiana agent with AI SDK v6 (Streaming Mode)
 */
async function runKianaStreaming(agent, // Use any to avoid complex typing issues
instruction, writer, verbose) {
    if (verbose) {
        console.log('[Kiana] Starting streaming execution...');
    }
    const result = await agent.stream({
        prompt: instruction,
    });
    writer.write('Assistant: ');
    for await (const textPart of result.textStream) {
        writer.write(textPart);
    }
    writer.write('\n');
    const finalText = await result.text;
    const usage = await result.usage;
    if (verbose) {
        console.log(`[Kiana] Execution complete. Usage:`, usage);
    }
    return finalText;
}
/**
 * Run Kiana agent with AI SDK v6 (Non-Streaming Mode)
 */
async function runKianaRegular(agent, // Use any to avoid complex typing issues
instruction, writer, verbose) {
    if (verbose) {
        console.log('[Kiana] Starting regular execution...');
    }
    const result = await agent.generate({
        prompt: instruction,
    });
    writer.write('Assistant: ');
    writer.write(result.text);
    writer.write('\n');
    if (verbose) {
        console.log(`[Kiana] Execution complete. Usage:`, result.usage);
    }
    return result.text;
}
/**
 * Main function to run Kiana agent with AI SDK v6
 */
async function runKianaV6(options, memtools, writer) {
    try {
        // Create the agent
        const agent = await (0, exports.createKianaAgent)(memtools, options);
        if (options.verbose) {
            console.log('[Kiana] Agent created successfully');
            console.log(`[Kiana] Instruction: ${options.instruction}`);
        }
        // Execute based on streaming preference
        if (options.stream) {
            return await runKianaStreaming(agent, options.instruction, writer, options.verbose || false);
        }
        else {
            return await runKianaRegular(agent, options.instruction, writer, options.verbose || false);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        writer.writeLine(`\n[Kiana] Error: ${errorMsg}`);
        if (options.verbose) {
            console.error('[Kiana] Full error:', error);
        }
        throw error;
    }
}
/**
 * Compatibility wrapper for existing API
 * Maintains backward compatibility with the original runKiana function
 */
async function runKiana(options, memtools, writer) {
    // Map old options to new format (handle legacy apiKey)
    const legacyOptions = options;
    const v6Options = {
        instruction: options.instruction,
        systemPrompt: options.systemPrompt,
        model: options.model,
        maxRounds: options.maxRounds,
        verbose: options.verbose,
        stream: false, // Default to non-streaming for compatibility
        // Map API key to ARK config if provided
        arkConfig: legacyOptions.apiKey ? {
            modelId: options.model || 'gpt-4o-mini',
            apiKey: legacyOptions.apiKey,
            baseURL: process.env.ARK_BASE_URL || 'https://ark-runtime-api.aiheima.com/v1'
        } : undefined
    };
    return runKianaV6(v6Options, memtools, writer);
}
