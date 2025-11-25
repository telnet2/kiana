/**
 * touch - create empty file or update timestamp
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function touch(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'touch',
        description: 'Create empty file or update timestamp',
        add_help: true
    });

    parser.add_argument('files', {
        nargs: '+',
        help: 'Files to touch'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    for (const pathStr of parsed.files) {
        const node = context.fs.resolvePath(pathStr);
        if (node) {
            node.modifiedAt = new Date();
        } else {
            context.fs.createFile(pathStr, '');
        }
    }

    return '';
}
