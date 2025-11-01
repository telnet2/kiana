/**
 * Kiana - LLM Agent for MemShell
 *
 * Integrates OpenAI's Responses API with MemTools to create an autonomous
 * agent that can execute shell commands in the in-memory filesystem.
 */

import OpenAILib from 'openai';
import { MemTools } from './MemTools';
import { Writer } from './Writer';

// Support both named and default exports from openai package
const OpenAI = (OpenAILib as any).OpenAI || OpenAILib;

/**
 * Default system prompt for Kiana agent
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Kiana, an expert software engineer with access to an in-memory filesystem.

You have access to the memfs_exec tool which executes shell commands in the in-memory filesystem.

Available commands:
- File operations: ls, cat, touch, rm, write
- Directory operations: pwd, cd, mkdir
- Text processing: echo, grep, sed, diff, patch, find
- Utilities: date
- I/O: import, export (between MemFS and real filesystem)
- Execution: node (sandboxed JavaScript execution)

The filesystem supports:
- Pipelines: cmd1 | cmd2
- Redirections: cmd > file, cmd >> file, cmd << EOF
- Operators: cmd1 && cmd2, cmd1 || cmd2, cmd1 ; cmd2
- Wildcards: *.txt, file?.js
- Command substitution: $(command) - replaces with command output

Best practices:
1. Use 'ls' and 'cat' to verify your work
2. Break complex tasks into steps
3. Check command output before proceeding
4. Use command substitution for dynamic values: echo "Today is $(date)"
5. Provide a summary when complete

When you finish the task, provide a clear summary of what you accomplished.`;

/**
 * Options for running Kiana agent
 */
export interface KianaOptions {
    /** User instruction/task */
    instruction: string;
    /** System prompt (defaults to DEFAULT_SYSTEM_PROMPT) */
    systemPrompt?: string;
    /** OpenAI model to use */
    model?: string;
    /** Maximum tool-call rounds */
    maxRounds?: number;
    /** Verbose logging */
    verbose?: boolean;
    /** OpenAI API key (defaults to env) */
    apiKey?: string;
}

/**
 * Message state for tracking streaming output
 */
interface MessageState {
    headerPrinted: boolean;
    done: boolean;
}

/**
 * Function call state for tracking tool invocations
 */
interface FunctionCallState {
    name: string;
    call_id: string;
    arguments: string;
    logged: boolean;
}

/**
 * Extract assistant text from response
 */
function extractAssistantText(response: any): string {
    const outputs = response?.output || [];
    const parts: string[] = [];

    for (const item of outputs) {
        if (item.type === 'reasoning') {
            // Extract reasoning summary
            const summary = item.summary || [];
            const summaryText = summary
                .filter((part: any) => part.type === 'reasoning_text')
                .map((part: any) => part.text.trim())
                .filter(Boolean)
                .join(' ');
            if (summaryText) {
                parts.push(`(reasoning) ${summaryText}`);
            }

            // Extract detailed thinking
            const detailed = (item.content || [])
                .filter((part: any) => part.type === 'reasoning_text')
                .map((part: any) => part.text.trim())
                .filter(Boolean)
                .join(' ');
            if (detailed) {
                parts.push(`(thinking) ${detailed}`);
            }
        } else if (item.type === 'message') {
            // Extract message content
            const messageText = (item.content || [])
                .filter((content: any) => content.type === 'output_text')
                .map((content: any) => content.text.trim())
                .filter(Boolean)
                .join('\n');
            if (messageText) {
                parts.push(messageText);
            }
        }
    }

    // Fallback to output_text if present
    if (response?.output_text) {
        const trimmed = response.output_text.trim();
        if (trimmed && !parts.includes(trimmed)) {
            parts.push(trimmed);
        }
    }

    return parts.join('\n');
}

/**
 * Extract function calls from response
 */
function extractFunctionCalls(response: any): any[] {
    const outputs = response?.output || [];
    return outputs.filter((item: any) => item.type === 'function_call');
}

/**
 * Stream an exchange with OpenAI
 */
async function streamExchange(
    client: any,
    params: any,
    writer: Writer,
    verbose: boolean = false
): Promise<any> {
    const stream = await client.responses.stream({
        ...params,
        stream: true,
        stream_options: { include_obfuscation: false, ...(params.stream_options || {}) },
    });

    const messageState = new Map<string, MessageState>();
    const functionCallState = new Map<string, FunctionCallState>();
    let finalResponse: any = null;

    const ensureMessageHeader = (info: MessageState) => {
        if (!info.headerPrinted) {
            writer.write('Assistant: ');
            info.headerPrinted = true;
        }
    };

    try {
        for await (const event of stream) {
            switch (event.type) {
                case 'response.output_item.added':
                    if (event.item.type === 'message') {
                        messageState.set(event.item.id, { headerPrinted: false, done: false });
                    } else if (event.item.type === 'function_call') {
                        functionCallState.set(event.item.id, {
                            name: event.item.name,
                            call_id: event.item.call_id,
                            arguments: '',
                            logged: false,
                        });
                        if (verbose) {
                            writer.writeLine(`\n[Kiana] Calling tool ${event.item.name}...`);
                        }
                    }
                    break;

                case 'response.output_text.delta': {
                    const info = messageState.get(event.item_id) || { headerPrinted: false, done: false };
                    if (!messageState.has(event.item_id)) {
                        messageState.set(event.item_id, info);
                    }
                    ensureMessageHeader(info);
                    writer.write(event.delta);
                    break;
                }

                case 'response.output_text.done': {
                    const info = messageState.get(event.item_id);
                    if (info) {
                        info.done = true;
                        ensureMessageHeader(info);
                        writer.write('\n');
                    }
                    break;
                }

                case 'response.function_call_arguments.delta': {
                    const callInfo = functionCallState.get(event.item_id);
                    if (callInfo) {
                        callInfo.arguments += event.delta;
                    }
                    break;
                }

                case 'response.function_call_arguments.done': {
                    const callInfo = functionCallState.get(event.item_id);
                    if (callInfo && !callInfo.logged) {
                        callInfo.logged = true;
                        callInfo.arguments = event.arguments || callInfo.arguments;
                        if (verbose) {
                            try {
                                const parsed = JSON.parse(callInfo.arguments);
                                writer.writeLine(`[Kiana] ${callInfo.name}(${JSON.stringify(parsed)})`);
                            } catch (error) {
                                writer.writeLine(`[Kiana] ${callInfo.name} arguments: ${callInfo.arguments}`);
                            }
                        }
                    }
                    break;
                }

                case 'response.completed':
                    finalResponse = event.response;
                    break;

                case 'response.failed':
                    throw new Error(
                        event.response?.error?.message || 'Streaming response failed without details.'
                    );

                case 'response.incomplete':
                    throw new Error('Streaming response ended incomplete.');

                case 'error':
                    throw new Error(event.message + (event.code ? ` (code: ${event.code})` : ''));

                default:
                    break;
            }
        }
    } finally {
        // Ensure all messages have newlines
        for (const info of Array.from(messageState.values())) {
            if (info.headerPrinted && !info.done) {
                writer.write('\n');
            }
        }
    }

    // Get final response
    const parsed = await stream.finalResponse();
    return finalResponse || parsed;
}

/**
 * Run Kiana agent
 */
export async function runKiana(
    options: KianaOptions,
    memtools: MemTools,
    writer: Writer
): Promise<string> {
    // Validate options
    const instruction = options.instruction;
    if (!instruction) {
        throw new Error('Instruction is required');
    }

    const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const model = options.model || 'gpt-4o-mini';
    const maxRounds = options.maxRounds || 20;
    const verbose = options.verbose || false;

    // Check for API key
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error(
            'OPENAI_API_KEY must be set in environment or passed via options.apiKey'
        );
    }

    // Create OpenAI client
    const client = new OpenAI({ apiKey });

    // Prepare tool definition
    const legacyTool = memtools.getOpenAIToolDefinition();
    const tool = {
        type: 'function',
        name: legacyTool.function.name,
        description: legacyTool.function.description,
        parameters: legacyTool.function.parameters,
    };

    // Create conversation
    if (verbose) {
        writer.writeLine(`[Kiana] Creating conversation with model ${model}...`);
    }

    const conversation = await client.conversations.create();
    if (verbose) {
        writer.writeLine(`[Kiana] Conversation ID: ${conversation.id}\n`);
    }

    const baseRequest = {
        model,
        conversation: { id: conversation.id },
        tools: [tool],
    };

    // Initial exchange
    let response = await streamExchange(
        client,
        {
            ...baseRequest,
            input: [
                {
                    role: 'system',
                    content: [{ type: 'input_text', text: systemPrompt }],
                },
                {
                    role: 'user',
                    content: [{ type: 'input_text', text: instruction }],
                },
            ],
        },
        writer,
        verbose
    );

    // Tool execution loop
    let round = 0;
    while (round < maxRounds) {
        round++;

        const functionCalls = extractFunctionCalls(response);
        if (functionCalls.length === 0) {
            break; // No more tool calls, agent is done
        }

        const toolOutputs: any[] = [];
        for (const call of functionCalls) {
            let command: string | null = null;
            try {
                const args = JSON.parse(call.arguments || '{}');
                command = args.command;
            } catch (error) {
                command = null;
            }

            if (!command) {
                const errorMsg = 'ERROR: Missing command parameter for memfs_exec.';
                if (verbose) {
                    writer.writeLine(`[Kiana] ${errorMsg}`);
                }
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output: errorMsg,
                });
                continue;
            }

            writer.writeLine(`\n[Tool] Executing command:`);
            writer.writeLine(command);
            writer.writeLine('');

            let toolResult: string;
            try {
                toolResult = memtools.exec(command);
            } catch (err: any) {
                toolResult = `ERROR: ${err.message}`;
            }

            const display = toolResult && toolResult.trim() ? toolResult : '(no output)';
            writer.writeLine('[Tool Output]');
            writer.writeLine(display);
            writer.writeLine('');

            toolOutputs.push({
                type: 'function_call_output',
                call_id: call.call_id,
                output: toolResult || '(success - no output)',
            });
        }

        // Continue conversation with tool outputs
        response = await streamExchange(
            client,
            {
                ...baseRequest,
                input: toolOutputs,
            },
            writer,
            verbose
        );
    }

    if (round >= maxRounds) {
        writer.writeLine(
            `\n[Kiana] Warning: Reached maximum rounds (${maxRounds}) without completion.`
        );
    }

    // Extract final assistant message
    const finalText = extractAssistantText(response);
    return finalText;
}
