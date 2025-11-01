/**
 * kiana - LLM agent with memshell access
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from './types';
import { runKiana, DEFAULT_SYSTEM_PROMPT } from '../KianaAgent';
import { MemTools } from '../MemTools';
import { StdoutWriter } from '../Writer';

export function kiana(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'kiana',
        description: 'LLM agent with memshell access',
        add_help: true
    });

    parser.add_argument('instruction', {
        nargs: '?',
        help: 'Task instruction (text or file path in MemFS)'
    });
    parser.add_argument('--instruction', {
        dest: 'instruction_flag',
        help: 'Task instruction (text or file path in MemFS)'
    });
    parser.add_argument('--system-prompt', {
        dest: 'system_prompt',
        help: 'System prompt file path in MemFS'
    });
    parser.add_argument('--model', {
        default: 'gpt-4o-mini',
        help: 'OpenAI model to use (default: gpt-4o-mini)'
    });
    parser.add_argument('--max-rounds', {
        type: 'int',
        default: 20,
        dest: 'max_rounds',
        help: 'Maximum tool-call rounds (default: 20)'
    });
    parser.add_argument('--verbose', {
        action: 'store_true',
        help: 'Enable verbose logging'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // Determine instruction
    let instruction = parsed.instruction_flag || parsed.instruction;
    if (!instruction) {
        throw new Error('kiana: instruction required (positional or --instruction)');
    }

    // Try to read instruction from MemFS if it looks like a file
    const instructionNode = context.fs.resolvePath(instruction);
    if (instructionNode && instructionNode.isFile()) {
        instruction = instructionNode.read();
    }

    // Read system prompt from MemFS if provided
    let systemPrompt: string | undefined = undefined;
    if (parsed.system_prompt) {
        const promptNode = context.fs.resolvePath(parsed.system_prompt);
        if (!promptNode) {
            throw new Error(`kiana: ${parsed.system_prompt}: No such file or directory`);
        }
        if (!promptNode.isFile()) {
            throw new Error(`kiana: ${parsed.system_prompt}: Is a directory`);
        }
        systemPrompt = promptNode.read();
    }

    // Create MemTools instance with the same filesystem
    const memtools = new MemTools(context.fs);

    // Create stdout writer
    const writer = new StdoutWriter();

    // Run Kiana agent (this is async, but we need to handle it synchronously)
    // We'll use a synchronous wrapper via a promise
    let result = '';
    let error: Error | null = null;

    (async () => {
        try {
            result = await runKiana(
                {
                    instruction,
                    systemPrompt,
                    model: parsed.model,
                    maxRounds: parsed.max_rounds,
                    verbose: parsed.verbose,
                },
                memtools,
                writer
            );
        } catch (err: any) {
            error = err;
        }
    })().then(() => {
        // Promise resolved
    }).catch((err) => {
        error = err;
    });

    // Wait for the async operation to complete
    // This is a hack, but necessary since exec() is synchronous
    const deasync = require('deasync');
    while (result === '' && error === null) {
        deasync.runLoopOnce();
    }

    if (error) {
        throw error;
    }

    return result;
}
