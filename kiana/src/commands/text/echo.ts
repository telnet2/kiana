/**
 * echo - display a line of text
 */

import { CommandContext } from '../types';

export function echo(context: CommandContext, args: string[]): string {
    return args.join(' ');
}
