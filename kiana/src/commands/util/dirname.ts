/**
 * dirname - strip last component from file path(s)
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function dirname(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'dirname',
        description: 'Strip last component from file path(s)',
        add_help: true
    });

    parser.add_argument('paths', {
        nargs: '+',
        help: 'File path(s)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const paths = parsed.paths;

    if (!paths || paths.length === 0) {
        throw new Error('dirname: missing operand');
    }

    const results: string[] = [];

    for (const path of paths) {
        // Handle edge cases
        if (path === '/' || path === '') {
            results.push('.');
            continue;
        }

        // Remove trailing slashes
        let normalized = path.replace(/\/+$/, '');

        // Handle paths with no directory component
        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash === -1) {
            results.push('.');
            continue;
        }

        // Extract directory
        if (lastSlash === 0) {
            results.push('/');
        } else {
            results.push(normalized.substring(0, lastSlash));
        }
    }

    return results.join('\n');
}
