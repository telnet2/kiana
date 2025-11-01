#!/usr/bin/env node
'use strict';

/**
 * Advanced Example: Using OpenAI Responses API with MemTools/MemShell
 *
 * This demo spins up an in-memory filesystem, seeds a prompt.txt instruction,
 * then lets an LLM agent (via the stateful Responses API + streaming) build a
 * vanilla JavaScript solution in main.js. The agent must interact with the
 * filesystem exclusively through the memfs_exec tool.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-xxx node examples/llm-range-sum.js --range 1,100 [--model gpt-4.1-mini] [--output ./export-dir]
 *
 * After the agent finishes, the script executes main.js inside MemFS, verifies
 * the output, and clones the entire MemFS to the specified directory so you can
 * inspect the generated files locally.
 */

const fs = require('fs');
const path = require('path');
const OpenAILib = require('openai');
const { MemTools } = require('../src/MemTools');

function parseArgs(argv) {
    const opts = {
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        output: null,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            process.exit(0);
        } else if (arg === '--range') {
            opts.range = argv[++i];
        } else if (arg.startsWith('--range=')) {
            opts.range = arg.slice('--range='.length);
        } else if (arg === '--model') {
            opts.model = argv[++i];
        } else if (arg.startsWith('--model=')) {
            opts.model = arg.slice('--model='.length);
        } else if (arg === '--output' || arg === '--out') {
            opts.output = argv[++i];
        } else if (arg.startsWith('--output=')) {
            opts.output = arg.slice('--output='.length);
        } else if (arg.startsWith('--out=')) {
            opts.output = arg.slice('--out='.length);
        } else {
            console.warn(`Unknown argument: ${arg}`);
            printUsage();
            process.exit(1);
        }
    }

    if (!opts.range) {
        console.error('Missing required --range flag (e.g., --range 1,100)');
        printUsage();
        process.exit(1);
    }

    const { start, end } = parseRange(opts.range);
    opts.start = start;
    opts.end = end;
    opts.output = path.resolve(opts.output || `./memfs-range-sum-${start}-${end}`);
    return opts;
}

function printUsage() {
    console.log(`Usage: node examples/llm-range-sum.js --range M,N [--model <model>] [--output <dir>]

Options:
  --range     Inclusive range (e.g., 1,100) required by the prompt.
  --model     OpenAI model ID (default: ${process.env.OPENAI_MODEL || 'gpt-4.1-mini'}).
  --output    Directory to clone the MemFS contents into (default: ./memfs-range-sum-M-N).
`);
}

function parseRange(rangeStr) {
    const parts = rangeStr.split(',').map((p) => p.trim());
    if (parts.length !== 2) {
        throw new Error(`Invalid --range value "${rangeStr}". Expected format M,N`);
    }
    const start = Number(parts[0]);
    const end = Number(parts[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`Range values must be integers. Received: ${rangeStr}`);
    }
    if (end < start) {
        throw new Error(`Range end (${end}) must be >= start (${start}).`);
    }
    return { start, end };
}

function buildPromptContent(start, end) {
    return `# Task: Range Summation Utility

Implement main.js following these requirements:

1. Create vanilla JavaScript (no external Node modules). Do not call require() other than accessing built-in globals.
2. Accept an argument of the form \`--range M,N\` (exact flag name) via \`process.argv\`.
3. Validate the input:
   - Ensure the flag exists.
   - Ensure M and N are integers.
   - Ensure M <= N.
   - If validation fails, print a clear error message and exit with a non-zero code.
4. Use a classic \`for\` loop to sum all integers from M to N inclusive. Do not use Array utilities (reduce, etc.).
5. Print the result exactly as: \`Sum from M to N is RESULT\`.
6. Avoid any dependencies on Node built-in modules except for default globals (console, process).
7. Do NOT call process.exit; instead log the error and simply return (or throw) to stop execution.

Example:
  node main.js --range ${start},${end}
should output:
  Sum from ${start} to ${end} is <sum>

After implementing main.js, run the example command inside the current environment to verify it works.`;
}

function extractAssistantText(response) {
    const outputs = response.output || [];
    const parts = [];

    for (const item of outputs) {
        if (item.type === 'reasoning') {
            const summary = item.summary || [];
            const reasoningText = summary
                .filter((part) => part.type === 'reasoning_text')
                .map((part) => part.text.trim())
                .filter(Boolean)
                .join(' ');
            if (reasoningText) {
                parts.push(`(reasoning) ${reasoningText}`);
            }
            const detailed = (item.content || [])
                .filter((part) => part.type === 'reasoning_text')
                .map((part) => part.text.trim())
                .filter(Boolean)
                .join(' ');
            if (detailed) {
                parts.push(`(thinking) ${detailed}`);
            }
        } else if (item.type === 'message') {
            const messageText = (item.content || [])
                .filter((content) => content.type === 'output_text')
                .map((content) => content.text.trim())
                .filter(Boolean)
                .join('\n');
            if (messageText) {
                parts.push(messageText);
            }
        }
    }

    if (response.output_text) {
        const trimmed = response.output_text.trim();
        if (trimmed && !parts.includes(trimmed)) {
            parts.push(trimmed);
        }
    }

    return parts.join('\n');
}

function extractFunctionCalls(response) {
    const outputs = response.output || [];
    return outputs.filter((item) => item.type === 'function_call');
}

async function streamExchange(client, params) {
    const stream = await client.responses.stream({
        ...params,
        stream: true,
        stream_options: { include_obfuscation: false, ...(params.stream_options || {}) },
    });

    const messageState = new Map();
    const functionCallState = new Map();
    let finalResponse = null;

    const ensureMessageHeader = (info) => {
        if (!info.headerPrinted) {
            process.stdout.write('Assistant: ');
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
                        console.log(`Assistant is calling tool ${event.item.name}...`);
                    }
                    break;
                case 'response.output_text.delta': {
                    const info =
                        messageState.get(event.item_id) || { headerPrinted: false, done: false };
                    if (!messageState.has(event.item_id)) {
                        messageState.set(event.item_id, info);
                    }
                    ensureMessageHeader(info);
                    process.stdout.write(event.delta);
                    break;
                }
                case 'response.output_text.done': {
                    const info = messageState.get(event.item_id);
                    if (info) {
                        info.done = true;
                        ensureMessageHeader(info);
                        process.stdout.write('\n');
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
                        try {
                            const parsed = JSON.parse(callInfo.arguments);
                            console.log(`Assistant -> ${callInfo.name}(${JSON.stringify(parsed)})`);
                        } catch (error) {
                            console.log(
                                `Assistant -> ${callInfo.name} arguments: ${callInfo.arguments}`,
                            );
                        }
                    }
                    break;
                }
                case 'response.completed':
                    finalResponse = event.response;
                    break;
                case 'response.failed':
                    throw new Error(
                        event.response?.error?.message || 'Streaming response failed without details.',
                    );
                case 'response.incomplete':
                    throw new Error('Streaming response ended incomplete.');
                case 'error':
                    throw new Error(
                        event.message + (event.code ? ` (code: ${event.code})` : ''),
                    );
                default:
                    break;
            }
        }
    } finally {
        for (const info of messageState.values()) {
            if (info.headerPrinted && !info.done) {
                process.stdout.write('\n');
            }
        }
    }

    const parsed = await stream.finalResponse();
    return finalResponse || parsed;
}

function computeInclusiveSum(start, end) {
    const startBig = BigInt(start);
    const endBig = BigInt(end);
    const count = endBig - startBig + 1n;
    return (count * (startBig + endBig)) / 2n;
}

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY must be set in the environment.');
    }

    const options = parseArgs(process.argv.slice(2));
    const { start, end, model, output } = options;
    const rangeLabel = `${start},${end}`;

    const promptContent = buildPromptContent(start, end);
    const memtools = new MemTools();
    memtools.exec(`cat > prompt.txt <<'EOF'\n${promptContent}\nEOF`);

    const legacyTool = memtools.getOpenAIToolDefinition();
    const tool = {
        type: 'function',
        name: legacyTool.function.name,
        description: legacyTool.function.description,
        parameters: legacyTool.function.parameters,
    };

    const OpenAI = OpenAILib.OpenAI || OpenAILib;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const conversation = await client.conversations.create();
    console.log(`Conversation created: ${conversation.id}`);
    console.log('Seeding prompt.txt and starting agent...\n');

    const systemPrompt = [
        'You are an expert JavaScript developer working inside an in-memory filesystem.',
        'Interact with the workspace solely via the memfs_exec tool.',
        'Always inspect prompt.txt to understand the task before making changes.',
        'All JavaScript must be vanilla (no external Node modules, no require() beyond core globals).',
        `After implementing main.js, run "node main.js --range ${rangeLabel}" to verify it succeeds.`,
        'Conclude with a concise summary of what you created and tested.',
    ].join(' ');

    const userPrompt = [
        'The repository is an in-memory file system. Use memfs_exec to read and write files.',
        'prompt.txt already contains detailed requirements. Follow them precisely.',
        'Create main.js that satisfies the instructions, run the requested command to confirm it works,',
        'then let me know the results.',
    ].join(' ');

    const baseRequest = {
        model,
        conversation: { id: conversation.id },
        tools: [tool],
    };

    let response = await streamExchange(client, {
        ...baseRequest,
        input: [
            {
                role: 'system',
                content: [{ type: 'input_text', text: systemPrompt }],
            },
            {
                role: 'user',
                content: [{ type: 'input_text', text: userPrompt }],
            },
        ],
    });

    const maxToolRounds = 12;
    let round = 0;

    while (round < maxToolRounds) {
        round += 1;
        const functionCalls = extractFunctionCalls(response);
        if (functionCalls.length === 0) {
            break;
        }

        const toolOutputs = [];
        for (const call of functionCalls) {
            let command;
            try {
                const args = JSON.parse(call.arguments || '{}');
                command = args.command;
            } catch (error) {
                command = null;
            }

            if (!command) {
                const errorMsg = 'ERROR: Missing command parameter for memfs_exec.';
                console.log(errorMsg);
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output: errorMsg,
                });
                continue;
            }

            console.log(`\n[Tool] Executing command:\n${command}\n`);
            let toolResult;
            try {
                toolResult = memtools.exec(command);
            } catch (err) {
                toolResult = `ERROR: ${err.message}`;
            }

            const display = toolResult && toolResult.trim() ? toolResult : '(no output)';
            console.log(`[Tool Output]\n${display}\n`);

            toolOutputs.push({
                type: 'function_call_output',
                call_id: call.call_id,
                output: toolResult || '(success - no output)',
            });
        }

        response = await streamExchange(client, {
            ...baseRequest,
            input: toolOutputs,
        });
    }

    if (round >= maxToolRounds) {
        throw new Error('Exceeded maximum tool-call rounds without completion.');
    }

    const finalAssistantText = extractAssistantText(response);
    if (finalAssistantText) {
        console.log('\nAssistant final message:\n');
        console.log(finalAssistantText);
        console.log('');
    }

    const mainNode = memtools.fs.resolvePath('main.js');
    if (!mainNode || !mainNode.isFile()) {
        throw new Error('main.js was not created in the MemFS.');
    }

    const mainContent = memtools.exec('cat main.js');
    console.log('Retrieved main.js from MemFS.\n');

    const executionCommand = `node main.js --range ${rangeLabel}`;
    console.log(`Executing "${executionCommand}" inside MemFS...`);
    let executionOutput;
    try {
        executionOutput = memtools.exec(executionCommand);
    } catch (err) {
        throw new Error(`Failed to execute main.js: ${err.message}`);
    }
    console.log(`Program output:\n${executionOutput}\n`);

    const expectedSum = computeInclusiveSum(start, end).toString();
    if (!executionOutput.includes(expectedSum)) {
        console.warn(
            `Warning: Program output does not include expected sum (${expectedSum}). Please review main.js.`,
        );
    }

    if (fs.existsSync(output)) {
        fs.rmSync(output, { recursive: true, force: true });
    }
    memtools.fs.clone(output);
    console.log(`MemFS cloned to: ${output}`);

    const exportedEntries = fs.readdirSync(output, { withFileTypes: true });
    console.log('\nExported files:');
    exportedEntries.forEach((entry) => {
        console.log(`- ${entry.name}${entry.isDirectory() ? '/' : ''}`);
    });

    console.log('\n--- prompt.txt ---');
    console.log(memtools.exec('cat prompt.txt'));

    console.log('\n--- main.js ---');
    console.log(mainContent);

    console.log('\n--- Execution Output ---');
    console.log(executionOutput);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { main };
