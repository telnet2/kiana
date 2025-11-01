#!/usr/bin/env node
'use strict';

/**
 * Demo: Guess-the-number with streaming using the OpenAI Responses API (v2 style).
 *
 * This example relies on the newer responses.create()/responses.stream() interface
 * where tools are provided inline as real JavaScript functions. Tool invocations
 * are handled automatically by the SDK, so we only need to focus on streaming
 * the assistant output.
 *
 * Requirements:
 *   npm install openai
 *   OPENAI_API_KEY=sk-xxx node examples/llm-guess-number-streaming-v2.js --answer=42
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
    console.log(`Usage: node examples/llm-guess-number-streaming-v2.js --answer=<integer> [--model=<model>] [--max-turns=<n>]

Options:
  --answer       Hidden number the model must guess (required).
  --model        OpenAI model ID (default: gpt-4.1-mini).
  --max-turns    Soft cap on interaction rounds (default: 20).
`);
}

function createCheckGuessTool(answer, maxTurns) {
    let attempts = 0;
    let warnedMax = false;

    return {
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
        function: async ({ guess }) => {
            attempts += 1;

            if (!Number.isInteger(guess)) {
                console.log(`[Tool] Turn ${attempts}: invalid guess (${guess}).`);
                throw new Error('Invalid guess: please provide an integer.');
            }

            const comparison = guess < answer ? '>' : guess > answer ? '<' : '=';
            const meaning =
                comparison === '='
                    ? 'correct'
                    : comparison === '>'
                    ? 'hidden number is greater'
                    : 'hidden number is smaller';

            console.log(`[Tool] Turn ${attempts}: guess ${guess} -> ${comparison} (${meaning}).`);

            if (!warnedMax && attempts >= maxTurns && comparison !== '=') {
                warnedMax = true;
                console.warn(`[Tool] Reached ${attempts} turns without a correct guess (soft cap: ${maxTurns}).`);
            }

            return comparison;
        },
    };
}

function extractAssistantText(response) {
    const outputs = response?.output || [];
    const parts = [];

    for (const item of outputs) {
        if (item.type === 'reasoning') {
            const summary = item.summary || [];
            const summaryText = summary
                .filter((part) => part.type === 'reasoning_text')
                .map((part) => part.text.trim())
                .filter(Boolean)
                .join(' ');
            if (summaryText) {
                parts.push(`(reasoning) ${summaryText}`);
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

    if (response?.output_text) {
        const trimmed = response.output_text.trim();
        if (trimmed && !parts.includes(trimmed)) {
            parts.push(trimmed);
        }
    }

    return parts.join('\n');
}

async function streamGuessingGame(client, { answer, model, maxTurns }) {
    const stream = await client.responses.stream({
        model,
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
        tools: [createCheckGuessTool(answer, maxTurns)],
        stream: true,
        stream_options: { include_obfuscation: false },
    });

    const messageState = new Map();
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
                    } else if (event.item.type === 'tool_call') {
                        console.log(`Assistant is requesting tool ${event.item.name} (handled inline).`);
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

        if (!finalResponse) {
            finalResponse = await stream.finalResponse();
        }
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

    console.log(`Starting the streaming guessing game with model ${model}...\n`);

    const response = await streamGuessingGame(client, { answer, model, maxTurns });
    const assistantText = extractAssistantText(response);

    const successMatch = /I found the number, which is (\d+)/i.exec(assistantText);
    if (successMatch) {
        const reported = Number(successMatch[1]);
        const correct = reported === answer;
        console.log(`\nModel reported the number as ${reported}. ${correct ? 'Correct!' : 'Incorrect.'}`);
        if (!correct) {
            console.warn(`Expected answer was ${answer}.`);
        }
    } else {
        console.warn('\nFinal assistant message did not follow the expected success format.');
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { main };
