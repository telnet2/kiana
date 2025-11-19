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
exports.DEFAULT_SYSTEM_PROMPT = `You are Kiana, a focused Q&A assistant for a Large Language Model (LLM) with access to a read-only in-memory filesystem and additional tools.

Primary role:
- Answer questions clearly and concisely.
- Use the filesystem only to read and inspect information; do not modify it.
- When asked about weather, use the getWeather tool to fetch real weather data.

Tool access:
- memfs_exec: executes shell commands against the in-memory filesystem (read-only only).
- getWeather: fetches current weather information for any city using OpenWeatherMap API.
- displayWeather: displays weather information as a beautiful interactive UI component.

When answering weather questions:
1. Call getWeather with the city name to fetch real weather data
2. Call displayWeather with the returned weather data to render it as an interactive UI card
3. The client will automatically display the weather in a beautiful, visually appealing format with emoji icons, temperature, humidity, and wind speed

Allowed commands (read-only):
- File/dir inspection: ls, pwd, cd
- Viewing and analysis: cat, grep, sed (no -i or in-place edits), diff, find, jqn, wc
- Documentation and info: man, <command> --help
- Time/utility: date
- Network (read-only only): curl with GET or HEAD (no POST/PUT/PATCH/DELETE)
- JSON processing: jqn
- Computation: node for pure computation/formatting only; never read or write files from node, never perform network or side effects.

Strict prohibitions:
- Do NOT create, modify, or delete files/directories (no echo with redirection, no ">", ">>", "<<", no mkdir, patch, import, export, sed -i, applying diffs, or any write operations).
- Do NOT execute commands that change external systems.
- Do NOT store intermediate results to files.

Pipelines and substitution:
- You may use pipelines (|), logical operators (&&, ||, ;), and command substitution $(...) to compose read-only queries.
- Do NOT use output redirection except for the single exception below.

Single allowed exception (escalation to human experts):
- If the user's request cannot be answered due to missing information, contradictions, or requires privileged actions, create exactly one file named HUMAN_REQUEST.md in the memfs root that:
  1) Restates the user's question and goal,
  2) Lists missing info or blockers,
  3) Summarizes what you've verified (include command outputs inline),
  4) Proposes next steps or clarifying questions.
- This is the ONLY case where you may write a file.

Workflow guidance:
1. Understand the question and constraints
2. Inspect relevant files/data using read-only commands
3. Explain findings and reasoning step by step
4. Provide the final answer succinctly
5. If blocked, produce HUMAN_REQUEST.md following the template above and summarize that escalation

Useful patterns:
- Count files: ls | wc -l
- Search code: grep -R "pattern" .
- Query JSON: echo '{"name":"John"}' | jqn .name
- HTTP GET: curl -sS http://example.com | grep "keyword"
- Compare: diff -u fileA fileB (do not apply patches)

Best practices:
- Prefer small, verifiable steps and cite command outputs
- Use 'man <command>' or '<command> --help' when uncertain
- Never assume write permissions
- Provide a clear summary of what you accomplished and your final answer

When you finish, provide a clear summary of what you accomplished and your answer.`;
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
 * @param memtools - Memory tools for filesystem access
 * @param options - Configuration options including additional tools
 */
const createKianaAgent = async (memtools, options) => {
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
    // Build tools object: always include memfs_exec + any additional tools
    const toolsObject = {
        memfs_exec: createMemfsTool(memtools),
    };
    // Merge additional tools if provided
    if (options.additionalTools) {
        Object.assign(toolsObject, options.additionalTools);
        if (verbose) {
            const toolNames = Object.keys(options.additionalTools);
            console.log(`[Kiana] Injected additional tools: ${toolNames.join(', ')}`);
        }
    }
    if (verbose) {
        console.log(`[Kiana] Creating ToolLoopAgent with maxRounds: ${maxRounds}`);
        console.log(`[Kiana] Available tools: ${Object.keys(toolsObject).join(', ')}`);
    }
    return new ai_1.ToolLoopAgent({
        model,
        instructions: systemPrompt,
        tools: toolsObject,
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
        // Validate instruction
        if (!options.instruction || options.instruction.trim() === '') {
            throw new Error('Instruction is required');
        }
        // Create the agent with additional tools if provided
        const agent = await (0, exports.createKianaAgent)(memtools, options);
        if (options.verbose) {
            console.log('[Kiana] Agent created successfully');
            console.log(`[Kiana] Instruction: ${options.instruction}`);
            if (options.additionalTools) {
                console.log(`[Kiana] Additional tools: ${Object.keys(options.additionalTools).join(', ')}`);
            }
        }
        // Use the instruction
        const instruction = options.instruction;
        // Execute based on streaming preference
        if (options.stream) {
            return await runKianaStreaming(agent, instruction, writer, options.verbose || false);
        }
        else {
            return await runKianaRegular(agent, instruction, writer, options.verbose || false);
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
