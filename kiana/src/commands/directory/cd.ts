/**
 * cd - change directory
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function cd(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'cd',
        description: 'Change directory',
        add_help: true
    });

    parser.add_argument('path', {
        nargs: '?',
        default: '/',
        help: 'Directory to change to'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    context.fs.changeDirectory(parsed.path);
    return '';
}
