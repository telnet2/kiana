/**
 * write - write text to a file
 */

import { CommandContext } from '../types';

export function write(context: CommandContext, args: string[]): string {
    if (args.length < 2) {
        throw new Error('write: missing file or content argument');
    }

    const filePath = args[0];
    const content = args.slice(1).join(' ');

    context.fs.createFile(filePath, content);
    return '';
}
