/**
 * xargs - build and execute commands from stdin
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function xargs(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'xargs',
        description: 'Build and execute commands from stdin',
        add_help: true
    });

    parser.add_argument('-n', '--max-args', {
        type: 'int',
        default: 0,
        metavar: 'NUM',
        help: 'Use at most NUM arguments per command'
    });

    parser.add_argument('-I', '--replace', {
        metavar: 'REPLACE_STR',
        help: 'Replace REPLACE_STR with input values'
    });

    parser.add_argument('-0', '--null', {
        action: 'store_true',
        help: 'Input items are null-terminated (for compatibility)'
    });

    parser.add_argument('-x', '--exit', {
        action: 'store_true',
        help: 'Exit if the size exceeds the limit'
    });

    parser.add_argument('command', {
        nargs: '*',
        help: 'Command to execute (default: echo)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // xargs requires stdin
    if (stdin === null || stdin === undefined) {
        throw new Error('xargs: no input provided');
    }

    const maxArgs = parsed.max_args;
    const replaceStr = parsed.replace;
    const commandParts = parsed.command || ['echo'];
    const exitIfTooLarge = parsed.exit;

    // Parse input
    // Default delimiter is whitespace/newline
    const inputItems = stdin
        .trim()
        .split(/[\s\n]+/)
        .filter(item => item.length > 0);

    if (inputItems.length === 0) {
        return '';
    }

    // Collect results
    const results: string[] = [];

    if (replaceStr) {
        // Replace mode: replace placeholder with each input item
        for (const item of inputItems) {
            const cmdParts = commandParts.map((part: string) =>
                part.replace(replaceStr, item)
            );
            const cmdStr = cmdParts.join(' ');

            try {
                const result = context.stdin === null
                    ? context.fs.constructor.prototype.execSingle?.call?.(context, [cmdParts[0], ...cmdParts.slice(1)])
                    : '';

                // Use MemShell's exec mechanism
                // This is a limitation - we need access to the shell
                // For now, execute command via parsing
                results.push(executeCommand(context, cmdStr));
            } catch (err: any) {
                throw new Error(`xargs: ${err.message}`);
            }
        }
    } else if (maxArgs > 0) {
        // Batch mode: use maxArgs per command invocation
        for (let i = 0; i < inputItems.length; i += maxArgs) {
            const batch = inputItems.slice(i, i + maxArgs);
            const cmdStr = [...commandParts, ...batch].join(' ');

            try {
                results.push(executeCommand(context, cmdStr));
            } catch (err: any) {
                throw new Error(`xargs: ${err.message}`);
            }
        }
    } else {
        // Default mode: pass all arguments to command at once
        const cmdStr = [...commandParts, ...inputItems].join(' ');

        try {
            results.push(executeCommand(context, cmdStr));
        } catch (err: any) {
            throw new Error(`xargs: ${err.message}`);
        }
    }

    return results.join('\n');
}

/**
 * Helper to execute a command string
 */
function executeCommand(context: CommandContext, cmdStr: string): string {
    const { COMMANDS } = require('../index');

    const parts = cmdStr.trim().split(/\s+/);
    if (parts.length === 0) return '';

    const cmd = parts[0];
    const cmdArgs = parts.slice(1);

    if (!COMMANDS[cmd]) {
        throw new Error(`${cmd}: command not found`);
    }

    const def = COMMANDS[cmd];
    const cmdContext: CommandContext = {
        fs: context.fs,
        jsEngine: context.jsEngine,
        session: context.session,
        stdin: null,
        parseArgsWithHelp: context.parseArgsWithHelp,
        expandWildcards: context.expandWildcards,
        getAllFilesRecursive: context.getAllFilesRecursive,
    };

    if (def.acceptsStdin) {
        return def.execute(cmdContext, cmdArgs, null);
    }

    return def.execute(cmdContext, cmdArgs);
}
