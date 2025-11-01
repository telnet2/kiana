/**
 * curl - command-line tool for transferring data using URLs
 * 
 * Simple wrapper around system curl binary
 */

import { CommandContext } from '../types';
import { spawnSync } from 'child_process';

export function curl(context: CommandContext, args: string[], stdin: string | null = null): string {
    // Pass all arguments directly to curl
    const curlArgs = [...args];
    
    // If stdin is available, pipe it
    const result = spawnSync('curl', curlArgs, {
        encoding: 'utf-8',
        stdio: stdin ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
        input: stdin || undefined,
    });

    if (result.error) {
        throw new Error(`curl: command not found or failed: ${result.error.message}`);
    }

    // Return both stdout and stderr (curl uses stderr for progress/errors)
    const output = result.stdout || '';
    const errors = result.stderr || '';
    
    if (result.status !== 0 && errors) {
        // Show error but return exit code via exception
        throw new Error(`curl: ${errors.trim()}`);
    }

    return output;
}
