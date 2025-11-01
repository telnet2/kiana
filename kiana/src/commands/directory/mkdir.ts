/**
 * mkdir - make directories
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function mkdir(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'mkdir',
        description: 'Create directories',
        add_help: true
    });

    parser.add_argument('-p', '--parents', {
        action: 'store_true',
        help: 'Create parent directories as needed'
    });
    parser.add_argument('directories', {
        nargs: '+',
        help: 'Directories to create'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    for (const pathStr of parsed.directories) {
        if (parsed.parents) {
            context.fs.createDirectories(pathStr);
        } else {
            context.fs.createDirectory(pathStr);
        }
    }

    return '';
}
