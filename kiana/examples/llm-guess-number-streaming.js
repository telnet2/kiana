#!/usr/bin/env node
'use strict';

/**
 * Demo: Guess-the-number with streaming using the OpenAI Responses API.
 *
 * The Responses API is OpenAI's unified interface for stateful, streaming,
 * tool-using, and multi-modal responses. Instead of calling the legacy chat
 * completions endpoint, we ask `client.responses.stream(...)` for a stream of
 * server-sent events (SSE) and print tokens as soon as they arrive.
 *
 * Requirements:
 *   npm install openai
 *   OPENAI_API_KEY=sk-xxx node examples/llm-guess-number-streaming.js --answer=42
 *
 * The assistant can call the check_guess tool to learn whether its guess is too
 * high, too low, or correct. Once it receives "=", it must respond with
 * "I found the number, which is N".
 */

const OpenAILib = require('openai');

function parseArgs(argv) {
    const options = {
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        maxTurns: 20,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            printUsage();
            process.exit(0);
        } else if (arg.startsWith('--answer=')) {
            options.answer = Number(arg.split('=')[1]);
        } else if (arg === '--answer') {
            options.answer = Number(argv[++i]);
        } else if (arg.startsWith('--model=')) {
            options.model = arg.split('=')[1];
        } else if (arg === '--model') {
            options.model = argv[++i];
        } else if (arg.startsWith('--max-turns=')) {
            options.maxTurns = Number(arg.split('=')[1]);
        } else if (arg === '--max-turns') {
            options.maxTurns = Number(argv[++i]);
        } else {
            console.warn(`Unknown argument: ${arg}`);
            printUsage();
            process.exit(1);
        }
    }

    if (!Number.isInteger(options.answer)) {
        console.error('Missing required --answer flag with an integer value.');
        printUsage();
        process.exit(1);
    }

    if (!options.model) {
        console.error('Model cannot be empty.');
        process.exit(1);
    }

    if (!Number.isInteger(options.maxTurns) || options.maxTurns <= 0) {
        console.error('--max-turns must be a positive integer.');
        process.exit(1);
    }

    return options;
}

function printUsage() {
    console.log(`Usage: node examples/llm-guess-number-streaming.js --answer=<integer> [--model=<model>] [--max-turns=<n>]

Options:
  --answer       Hidden number the model must guess (required).
  --model        OpenAI model ID (default: gpt-4.1-mini).
  --max-turns    Safety cap on interaction rounds (default: 20).
`);
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

    if (response.output_text && !parts.includes(response.output_text.trim())) {
        const trimmed = response.output_text.trim();
        if (trimmed) {
            parts.push(trimmed);
        }
    }

    return parts.join('\n');
}

function extractFunctionCalls(response) {
    const outputs = response.output || [];
    return outputs.filter((item) => item.type === 'function_call');
}

/**
 * Stream a single exchange and surface SSE events as soon as they arrive.
 */
async function streamExchange(client, params) {
    const stream = await client.responses.stream({
        ...params,
        stream: true,
        stream_options: { include_obfuscation: false, ...(params.stream_options || {}) },
    });

    const messageState = new Map();
    const functionCallState = new Map();
    let finalResponse = null;
    let thrownError = null;

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
        finalResponse = await stream.finalResponse();
    } catch (error) {
        thrownError = error;
    } finally {
        for (const info of messageState.values()) {
            if (info.headerPrinted && !info.done) {
                process.stdout.write('\n');
            }
        }
    }

    if (thrownError) {
        throw thrownError;
    }

    if (!finalResponse) {
        throw new Error('No completion event received from the stream.');
    }

    return finalResponse;
}

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY must be set in the environment.');
    }

    const { answer, model, maxTurns } = parseArgs(process.argv.slice(2));
    const OpenAI = OpenAILib.OpenAI || OpenAILib;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const comparisonTool = {
        type: 'function',
        name: 'check_guess',
        description:
            'Compare an integer guess against the hidden number and return ">", "<", or "=". ">" means the hidden number is greater than the guess, "<" means it is smaller, "=" means the guess is correct.',
        parameters: {
            type: 'object',
            properties: {
                guess: {
                    type: 'integer',
                    description: 'The guessed integer.',
                },
            },
            required: ['guess'],
        },
    };

    const conversation = await client.conversations.create();
    console.log(`Conversation created: ${conversation.id}`);
    console.log('Starting the streaming guessing game...\n');

    const baseRequest = {
        model,
        conversation: { id: conversation.id },
        tools: [comparisonTool],
    };

    let response = await streamExchange(client, {
        ...baseRequest,
        input: [
            {
                role: 'system',
                content: [
                    {
                        type: 'input_text',
                        text: 'You are playing a number guessing game. Use the check_guess tool to compare guesses against the target. The tool returns ">" if the hidden number is greater than your guess, "<" if the hidden number is smaller than your guess, and "=" when you have guessed the hidden number exactly. When the tool returns "=", immediately respond exactly with "I found the number, which is N" with the correct integer in place of N.',
                    },
                ],
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: 'Let us start. Begin guessing the hidden integer. You may assume it is between 1 and 100.',
                    },
                ],
            },
        ],
    });

    let turns = 0;
    let foundNumber = null;

    while (turns < maxTurns) {
        turns += 1;

        const assistantText = extractAssistantText(response);
        const functionCalls = extractFunctionCalls(response);

        if (functionCalls.length === 0) {
            const successMatch = /I found the number, which is (\d+)/i.exec(assistantText);
            if (successMatch) {
                const reported = Number(successMatch[1]);
                const correct = reported === answer;
                console.log(`Model believes the number is ${reported}. ${correct ? 'Correct!' : 'Incorrect!'}`);
                if (!correct) {
                    console.warn(
                        `Warning: The reported number does not match the expected answer (${answer}).`,
                    );
                }
                break;
            }

            console.log('\nNo tool call detected. Nudging the assistant to keep guessing.\n');
            response = await streamExchange(client, {
                ...baseRequest,
                input: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: 'Please continue guessing by calling the check_guess tool.',
                            },
                        ],
                    },
                ],
            });
            continue;
        }

        const toolOutputs = [];

        for (const call of functionCalls) {
            let guess;
            try {
                const parsed = JSON.parse(call.arguments || '{}');
                guess = parsed.guess;
            } catch (error) {
                console.error('Failed to parse tool call arguments:', error);
            }

            if (!Number.isInteger(guess)) {
                const message = 'Invalid guess: please provide an integer.';
                console.log(`Tool: responding with error -> ${message}`);
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output: message,
                });
                continue;
            }

            const comparison = guess < answer ? '>' : guess > answer ? '<' : '=';
            const meaning =
                comparison === '='
                    ? 'correct'
                    : comparison === '>'
                    ? 'hidden number is greater'
                    : 'hidden number is smaller';
            console.log(`Tool invoked with guess ${guess} -> ${comparison} (${meaning})`);

            if (comparison === '=') {
                foundNumber = guess;
            }

            toolOutputs.push({
                type: 'function_call_output',
                call_id: call.call_id,
                output: comparison,
            });
        }

        response = await streamExchange(client, {
            ...baseRequest,
            input: toolOutputs,
        });
    }

    if (turns >= maxTurns) {
        console.error(`Reached the maximum number of turns (${maxTurns}) without completion.`);
    }

    if (foundNumber === answer) {
        console.log(`\nThe tool confirmed the correct number: ${foundNumber}.`);
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { main };
