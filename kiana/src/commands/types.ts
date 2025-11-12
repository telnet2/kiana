/**
 * Command system types for MemShell
 */

import { MemFS } from '../MemFS';
import { JSEngine } from '../JSEngine';
import { MemSession } from '../MemSession';
import { ArgumentParser } from 'argparse';

/**
 * Context provided to each command
 */
export interface CommandContext {
    /** In-memory filesystem */
    fs: MemFS;
    /** JavaScript execution engine */
    jsEngine: JSEngine;
    /** Session for tracking state */
    session: MemSession;
    /** Standard input (if piped) */
    stdin: string | null;
    /** Standard error output buffer */
    stderr?: string[];
    /** Helper to parse args with help support */
    parseArgsWithHelp: (parser: ArgumentParser, args: string[]) => any;
    /** Expand wildcard patterns in arguments */
    expandWildcards: (args: string[], cwd?: string) => string[];
    /** Get all files recursively from directory */
    getAllFilesRecursive: (dirPath: string) => string[];
}

/**
 * Command function signature
 */
export type CommandFunction = (context: CommandContext, args: string[], stdin?: string | null) => string;

/**
 * Command definition
 */
export interface CommandDefinition {
    /** The command execution function */
    execute: CommandFunction;
    /** Whether this command accepts stdin */
    acceptsStdin?: boolean;
}
