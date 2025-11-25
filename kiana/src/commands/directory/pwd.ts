/**
 * pwd - print working directory
 */

import { CommandContext } from '../types';

export function pwd(context: CommandContext, args: string[]): string {
    return context.fs.getCurrentDirectory();
}
