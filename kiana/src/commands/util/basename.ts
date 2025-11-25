/**
 * basename - strip directory and suffix from filenames
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function basename(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'basename',
        description: 'Strip directory and suffix from filenames',
        add_help: true
    });

    parser.add_argument('name', {
        help: 'The filename or path'
    });

    parser.add_argument('suffix', {
        nargs: '?',
        help: 'Optional suffix to remove'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const name = parsed.name;
    const suffix = parsed.suffix;

    // Extract basename from path
    let base = name;

    // Handle different path separators
    const lastSlash = Math.max(
        name.lastIndexOf('/'),
        name.lastIndexOf('\\')
    );

    if (lastSlash >= 0) {
        base = name.substring(lastSlash + 1);
    }

    // Remove suffix if provided
    if (suffix && base.endsWith(suffix)) {
        base = base.substring(0, base.length - suffix.length);
    }

    return base;
}
