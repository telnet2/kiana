#!/usr/bin/env ts-node
/**
 * Demo: Guess-the-number with streaming using the OpenAI Responses API (TypeScript edition).
 *
 * This version mirrors the JavaScript example but adds strong typing so you can
 * develop with `ts-node` or compile with `tsc`. Run it via:
 *
 *   npx ts-node examples/llm-guess-number-streaming-v2.ts --answer=42
 *
 * or build it:
 *
 *   npx tsc -p tsconfig.responses.json && node dist-responses/examples/llm-guess-number-streaming-v2.js --answer=42
 */

import OpenAI from 'openai';
import type {
    Response,
    ResponseFunctionToolCall,
    ResponseOutputItem,
    ResponseReasoningItem,
    ResponseOutputMessage,
    ResponseCreateParamsStreaming,
    Tool,
} from 'openai/resources/responses/responses';

interface Options {
    answer: number;
    model: string;
    maxTurns: number;
}

function parseArgs(argv: readonly string[]): Options {
    const options: Options = {
        model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
        maxTurns: 20,
        answer: Number.NaN,
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
            options.model = arg.split('=')[1]!;
        } else if (arg === '--model') {
            options.model = argv[++i]!;
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

function printUsage(): void {
    console.log(`Usage: ts-node examples/llm-guess-number-streaming-v2.ts --answer=<integer> [--model=<model>] [--max-turns=<n>]

Options:
  --answer       Hidden number the model must guess (required).
  --model        OpenAI model ID (default: gpt-4.1-mini).
  --max-turns    Soft cap on interaction rounds (default: 20).
`);
}

function createCheckGuessTool(): Tool {
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
            additionalProperties: false,
        },
        strict: true,
    };
}

interface GuessState {
    attempts: number;
    warnedMax: boolean;
}

function evaluateGuess(guess: number, state: GuessState, answer: number, maxTurns: number): string {
    state.attempts += 1;

    if (!Number.isInteger(guess)) {
        console.log(`[Tool] Turn ${state.attempts}: invalid guess (${guess}).`);
        throw new Error('Invalid guess: please provide an integer.');
    }

    const comparison = guess < answer ? '>' : guess > answer ? '<' : '=';
    const meaning =
        comparison === '='
            ? 'correct'
            : comparison === '>'
            ? 'hidden number is greater'
            : 'hidden number is smaller';

    console.log(`[Tool] Turn ${state.attempts}: guess ${guess} -> ${comparison} (${meaning}).`);

    if (!state.warnedMax && state.attempts >= maxTurns && comparison !== '=') {
        state.warnedMax = true;
        console.warn(`[Tool] Reached ${state.attempts} turns without a correct guess (soft cap: ${maxTurns}).`);
    }

    return comparison;
}

function isReasoningItem(item: ResponseOutputItem): item is ResponseReasoningItem {
    return item.type === 'reasoning';
}

function isMessageItem(item: ResponseOutputItem): item is ResponseOutputMessage {
    return item.type === 'message';
}

function isFunctionCallItem(item: ResponseOutputItem): item is ResponseFunctionToolCall {
    return item.type === 'function_call';
}

function extractAssistantText(response: Response): string {
    const outputs = response.output ?? [];
    const parts: string[] = [];

    for (const item of outputs) {
        if (isReasoningItem(item)) {
            const summaryText = (item.summary ?? [])
                .filter((part) => part.type === 'summary_text')
                .map((part) => part.text.trim())
                .filter(Boolean)
                .join(' ');
            if (summaryText) {
                parts.push(`(reasoning) ${summaryText}`);
            }

            const detailed = (item.content ?? [])
                .filter((part) => part.type === 'reasoning_text')
                .map((part) => part.text.trim())
                .filter(Boolean)
                .join(' ');
            if (detailed) {
                parts.push(`(thinking) ${detailed}`);
            }
        } else if (isMessageItem(item)) {
            const messageText = (item.content ?? [])
                .filter((content) => content.type === 'output_text')
                .map((content) => content.text.trim())
                .filter(Boolean)
                .join('\n');
            if (messageText) {
                parts.push(messageText);
            }
        }
    }

    const trimmed = response.output_text?.trim();
    if (trimmed && !parts.includes(trimmed)) {
        parts.push(trimmed);
    }

    return parts.join('\n');
}

function extractFunctionCalls(response: Response): ResponseFunctionToolCall[] {
    return (response.output ?? []).filter(
        (item): item is ResponseFunctionToolCall => item.type === 'function_call',
    );
}

type StreamParams = Omit<ResponseCreateParamsStreaming, 'stream'>;

async function streamExchange(client: OpenAI, params: StreamParams): Promise<Response> {
    const stream = await client.responses.stream({
        ...params,
        stream: true,
        stream_options: { include_obfuscation: false, ...(params.stream_options ?? {}) },
    } as ResponseCreateParamsStreaming);

    const messageState = new Map<string, { headerPrinted: boolean; done: boolean }>();
    let finalResponse: Response | null = null;
    let thrownError: unknown = null;

    const ensureMessageHeader = (info: { headerPrinted: boolean }) => {
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
                    } else if (isFunctionCallItem(event.item)) {
                        console.log(`Assistant is calling tool ${event.item.name}...`);
                    }
                    break;
                case 'response.output_text.delta': {
                    const info =
                        messageState.get(event.item_id) ?? { headerPrinted: false, done: false };
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
                    throw new Error(event.message + (event.code ? ` (code: ${event.code})` : ''));
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

interface FunctionCallOutput {
    type: 'function_call_output';
    call_id: string;
    output: string;
}

async function main(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY must be set in the environment.');
    }

    const { answer, model, maxTurns } = parseArgs(process.argv.slice(2));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log(`Starting the streaming guessing game with model ${model}...\n`);

    const conversation = await client.conversations.create();
    console.log(`Conversation created: ${conversation.id}`);
    console.log('Starting the streaming guessing game...\n');

    const conversationRef = { id: conversation.id };
    const tool = createCheckGuessTool();
    const guessState: GuessState = { attempts: 0, warnedMax: false };

    let response = await streamExchange(client, {
        model,
        conversation: conversationRef,
        tools: [tool],
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
    let foundNumber: number | null = null;

    while (turns < maxTurns) {
        turns += 1;

        const functionCalls = extractFunctionCalls(response);
        if (functionCalls.length === 0) {
            const assistantText = extractAssistantText(response);
            const successMatch = /I found the number, which is (\d+)/i.exec(assistantText);
            if (successMatch) {
                const reported = Number(successMatch[1]);
                const correct = reported === answer;
                console.log(
                    `Model believes the number is ${reported}. ${correct ? 'Correct!' : 'Incorrect!'}`,
                );
                if (!correct) {
                    console.warn(
                        `Warning: The reported number does not match the expected answer (${answer}).`,
                    );
                }
                break;
            }

            console.log('\nNo tool call detected. Nudging the assistant to keep guessing.\n');
            response = await streamExchange(client, {
                model,
                conversation: conversationRef,
                tools: [tool],
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

        const toolOutputs: FunctionCallOutput[] = [];

        for (const call of functionCalls) {
            let guessValue: number | null = null;
            try {
                const parsed = JSON.parse(call.arguments ?? '{}');
                if (typeof parsed.guess === 'number' && Number.isInteger(parsed.guess)) {
                    guessValue = parsed.guess;
                }
            } catch (error) {
                console.error('Failed to parse tool call arguments:', error);
            }

            if (guessValue === null) {
                const message = 'Invalid guess: please provide an integer.';
                console.log(`Tool: responding with error -> ${message}`);
                toolOutputs.push({
                    type: 'function_call_output',
                    call_id: call.call_id,
                    output: message,
                });
                continue;
            }

            const comparison = evaluateGuess(guessValue, guessState, answer, maxTurns);
            if (comparison === '=') {
                foundNumber = guessValue;
            }

            toolOutputs.push({
                type: 'function_call_output',
                call_id: call.call_id,
                output: comparison,
            });
        }

        response = await streamExchange(client, {
            model,
            conversation: conversationRef,
            tools: [tool],
            input: toolOutputs,
        });
    }

    if (turns >= maxTurns) {
        console.error(`Reached the maximum number of turns (${maxTurns}) without completion.`);
    }

    if (foundNumber === answer) {
        console.log(`\nThe tool confirmed the correct number: ${foundNumber}.`);
    }

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

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
