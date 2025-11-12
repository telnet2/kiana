/**
 * head - output the first part of files
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function head(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'head',
        description: 'Output the first part of files',
        add_help: true
    });

    parser.add_argument('-n', '--lines', {
        type: 'int',
        default: 10,
        metavar: 'NUM',
        help: 'Print first NUM lines (default: 10)'
    });

    parser.add_argument('-c', '--bytes', {
        type: 'int',
        metavar: 'NUM',
        help: 'Print first NUM bytes'
    });

    parser.add_argument('files', {
        nargs: '*',
        help: 'File(s) to read'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const numLines = parsed.lines;
    const numBytes = parsed.bytes;
    const files = parsed.files || [];

    // If no files specified, read from stdin
    if (files.length === 0) {
        if (stdin === null) {
            throw new Error('head: no input');
        }

        if (numBytes !== undefined) {
            return stdin.substring(0, numBytes);
        } else {
            const lines = stdin.split('\n');
            return lines.slice(0, numLines).join('\n');
        }
    }

    // Read from files
    const results: string[] = [];

    for (const file of files) {
        const node = context.fs.resolvePath(file);
        if (!node) {
            throw new Error(`head: ${file}: No such file or directory`);
        }

        if (!node.isFile()) {
            throw new Error(`head: ${file}: Is a directory`);
        }

        const content = node.read();

        if (numBytes !== undefined) {
            results.push(content.substring(0, numBytes));
        } else {
            const lines = content.split('\n');
            results.push(lines.slice(0, numLines).join('\n'));
        }
    }

    return results.join('\n');
}
