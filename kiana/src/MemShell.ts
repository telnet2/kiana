import { MemFS, MemNode, MemFile, MemDirectory } from './MemFS';
import { JSEngine } from './JSEngine';
import { parsePipeline, parseRedirections, isInlineHeredoc, parseInlineHeredoc, PipelineSegment, Redirection } from './CommandParser';
import { ArgumentParser } from 'argparse';
import * as Diff from 'diff';
import micromatch = require('micromatch');
import { runKiana, DEFAULT_SYSTEM_PROMPT } from './KianaAgent';
import { StdoutWriter, BufferWriter } from './Writer';
import { MemTools } from './MemTools';
import { COMMANDS, CommandContext } from './commands';
import { importCommand } from './commands/io/import';
import { exportCommand } from './commands/io/export';
import { node } from './commands/io/node';
import { kiana } from './commands/kiana';
import { MemSession } from './MemSession';

/**
 * Parsed arguments result
 */
interface ParsedArgs {
    flags: Record<string, any>;
    positional: string[];
}

/**
 * Help result from argument parser
 */
interface HelpResult {
    __help__: boolean;
    __message__: string;
}

/**
 * Shell-like command interface for MemFS
 */
export class MemShell {
    public fs: MemFS;
    public stdin: string | null;
    public jsEngine: JSEngine;
    public session: MemSession;

    constructor(memfs: MemFS | null = null, session: MemSession | null = null) {
        this.fs = memfs || new MemFS();
        this.stdin = null;
        this.jsEngine = new JSEngine(this.fs);
        this.session = session || new MemSession();
    }

    /**
     * Safely parse arguments with ArgumentParser without exiting process
     * Returns help text for -h/--help, throws error for invalid args
     */
    safeParseArgs(parser: ArgumentParser, args: string[]): any {
        // Save original process.exit and stream writes
        const originalExit = process.exit as any;
        const originalStdoutWrite = process.stdout.write;
        const originalStderrWrite = process.stderr.write;

        let exitCalled = false;
        let exitCode = 0;
        let capturedOutput = '';

        // Override process.exit to capture exit attempts
        (process as any).exit = (code: number) => {
            exitCalled = true;
            exitCode = code;
            throw new Error('__EXIT__');
        };

        // Override stdout.write to capture output
        (process.stdout as any).write = function(chunk: any): boolean {
            capturedOutput += chunk.toString();
            return true;
        };

        // Override stderr.write to capture errors
        (process.stderr as any).write = function(chunk: any): boolean {
            capturedOutput += chunk.toString();
            return true;
        };

        try {
            const result = parser.parse_args(args);
            return result;
        } catch (err: any) {
            if (err.message === '__EXIT__' && exitCalled) {
                // Check if this was a help request (exit code 0) or contains help text
                if ((exitCode === 0 || capturedOutput.includes('usage:')) && capturedOutput) {
                    // Return special object indicating help was requested
                    return { __help__: true, __message__: capturedOutput.trim() };
                }
                // This was an error
                throw new Error(capturedOutput.trim());
            }
            throw err;
        } finally {
            // Restore original functions
            process.exit = originalExit;
            process.stdout.write = originalStdoutWrite;
            process.stderr.write = originalStderrWrite;
        }
    }

    /**
     * Parse arguments and handle help requests
     * Returns parsed args or help text
     */
    parseArgsWithHelp(parser: ArgumentParser, args: string[]): any {
        const parsed = this.safeParseArgs(parser, args);
        if (parsed && parsed.__help__) {
            return parsed.__message__;
        }
        return parsed;
    }

    /**
     * Expand wildcard patterns in arguments to matching file paths
     * Supports patterns like *.txt, test.*, etc.
     */
    expandWildcards(args: string[], cwd: string = '/'): string[] {
        const expanded: string[] = [];

        // Flags that expect pattern arguments (should not expand wildcards for these)
        const patternFlags = ['-name', '-iname', '-path', '-ipath', '-regex', '-iregex'];
        let skipNext = false;

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            // If previous arg was a pattern flag, don't expand this arg
            if (skipNext) {
                expanded.push(arg);
                skipNext = false;
                continue;
            }

            // Check if this arg is a pattern flag
            if (patternFlags.includes(arg)) {
                expanded.push(arg);
                skipNext = true;
                continue;
            }

            // Check if argument contains wildcard characters
            if (arg.includes('*') || arg.includes('?') || arg.includes('[')) {
                // Determine the base directory for the pattern
                let baseDir = cwd;
                let pattern = arg;

                // If pattern starts with /, it's absolute
                if (arg.startsWith('/')) {
                    pattern = arg.substring(1);
                    baseDir = '/';
                } else if (arg.includes('/')) {
                    // Pattern has directory components
                    const lastSlash = arg.lastIndexOf('/');
                    const dirPart = arg.substring(0, lastSlash);
                    pattern = arg.substring(lastSlash + 1);

                    // Resolve the directory part
                    const resolvedBase = this.fs.resolvePath(baseDir);
                    if (resolvedBase) {
                        const targetDir = this.fs.resolvePath(dirPart, resolvedBase);
                        if (targetDir && targetDir.isDirectory()) {
                            baseDir = targetDir.getPath();
                        }
                    }
                }

                // Get all files from the base directory
                const allFiles = this.getAllFilesRecursive(baseDir);

                // Match against the pattern
                const matches = micromatch(allFiles, pattern);

                if (matches.length > 0) {
                    // Add matched files with proper path prefix
                    matches.forEach((match: string) => {
                        if (baseDir === '/') {
                            expanded.push('/' + match);
                        } else {
                            expanded.push(baseDir + '/' + match);
                        }
                    });
                } else {
                    // No matches - keep the original pattern
                    expanded.push(arg);
                }
            } else {
                // Not a wildcard, keep as-is
                expanded.push(arg);
            }
        }

        return expanded;
    }

    /**
     * Get all files recursively from a directory
     * Returns relative paths from the given directory
     */
    getAllFilesRecursive(dirPath: string): string[] {
        const files: string[] = [];
        const node = this.fs.resolvePath(dirPath);

        if (!node || !node.isDirectory()) {
            return files;
        }

        const traverse = (dir: MemDirectory, relativePath: string = ''): void => {
            // children is a Map, not a plain object
            for (const [name, child] of Array.from(dir.children.entries())) {
                const childPath = relativePath ? `${relativePath}/${name}` : name;

                if (child.isFile()) {
                    files.push(childPath);
                } else if (child.isDirectory()) {
                    // Add directory itself
                    files.push(childPath);
                    // Traverse children
                    traverse(child, childPath);
                }
            }
        };

        traverse(node);
        return files;
    }

    /**
     * Legacy parseArgs for commands not yet migrated to argparse
     * @deprecated Use command-specific ArgumentParser instead
     */
    parseArgs(args: string[]): ParsedArgs {
        const flags: Record<string, any> = {};
        const positional: string[] = [];

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('-')) {
                    flags[key] = nextArg;
                    i++;
                } else {
                    flags[key] = true;
                }
            } else if (arg.startsWith('-') && arg.length > 1 && !arg.match(/^-\d/)) {
                for (let j = 1; j < arg.length; j++) {
                    flags[arg[j]] = true;
                }
            } else {
                positional.push(arg);
            }
        }

        return { flags, positional };
    }

    /**
     * Execute a single command with optional stdin
     */
    execSingle(commandTokens: string[], stdin: string | null = null): string {
        if (!commandTokens || commandTokens.length === 0) {
            return '';
        }

        const command = commandTokens[0];
        let args = commandTokens.slice(1);

        // Expand wildcards in arguments (use current working directory from fs)
        const cwd = this.fs.getCurrentDirectory();
        args = this.expandWildcards(args, cwd);

        // Create command context for extracted commands
        const context: CommandContext = {
            fs: this.fs,
            jsEngine: this.jsEngine,
            session: this.session,
            stdin,
            parseArgsWithHelp: this.parseArgsWithHelp.bind(this),
            expandWildcards: this.expandWildcards.bind(this),
            getAllFilesRecursive: this.getAllFilesRecursive.bind(this),
        };

        // Try COMMANDS registry first
        if (COMMANDS[command]) {
            const def = COMMANDS[command];
            if (def.acceptsStdin && stdin !== null && stdin !== undefined) {
                return def.execute(context, args, stdin);
            }
            return def.execute(context, args);
        }

        throw new Error(`${command}: command not found`);
    }

    /**
     * Execute a pipeline of commands
     */
    execPipeline(pipeline: string[][], initialStdin: string | null = null): string {
        if (pipeline.length === 0) {
            return '';
        }

        let output: string | null = initialStdin;

        for (let i = 0; i < pipeline.length; i++) {
            const commandTokens = pipeline[i];

            // Parse redirections from command tokens
            const { command, redirections } = parseRedirections(commandTokens);

            // Execute command
            if (redirections.length > 0) {
                output = this.execWithRedirections(command, output, redirections);
            } else {
                output = this.execSingle(command, output);
            }
        }

        return output || '';
    }

    /**
     * Execute a command with HEREDOC support
     */
    execWithHeredoc(command: string, content: string): string {
        // Parse the command
        const tokens = command.trim().split(/\s+/);
        const cmd = tokens[0];
        const args = tokens.slice(1);

        // Use COMMANDS registry for all commands
        if (!COMMANDS[cmd]) {
            throw new Error(`${cmd}: command not found or does not support HEREDOC`);
        }

        const context: CommandContext = {
            fs: this.fs,
            jsEngine: this.jsEngine,
            session: this.session,
            stdin: content,
            parseArgsWithHelp: this.parseArgsWithHelp.bind(this),
            expandWildcards: this.expandWildcards.bind(this),
            getAllFilesRecursive: this.getAllFilesRecursive.bind(this),
        };
        
        const def = COMMANDS[cmd];
        if (def.acceptsStdin) {
            return def.execute(context, args, content);
        }
        
        // For commands that don't accept stdin, execute normally
        return def.execute(context, args);
    }

    /**
     * Execute a command with redirections
     */
    execWithRedirections(commandTokens: string[], stdin: string | null = null, redirections: Redirection[] = []): string {
        // Find input redirection (<)
        const inputRedirect = redirections.find(r => r.type === '<');
        let actualStdin = stdin;

        // If there's an input redirection, read the file and use it as stdin
        if (inputRedirect && 'target' in inputRedirect) {
            const node = this.fs.resolvePath(inputRedirect.target);
            if (!node) {
                throw new Error(`${inputRedirect.target}: No such file or directory`);
            }
            if (!node.isFile()) {
                throw new Error(`${inputRedirect.target}: Is a directory`);
            }
            actualStdin = node.read();
        }

        // Find HEREDOC redirection (takes precedence over input redirection if both exist)
        const heredocRedirect = redirections.find(r => r.type === '<<');
        if (heredocRedirect && 'delimiter' in heredocRedirect) {
            // For HEREDOC in interactive mode, content will be provided separately
            // This is just marking that we expect HEREDOC input
            actualStdin = stdin;
        }

        // Check if there's any stderr redirection
        const hasStderrRedirection = redirections.some(r =>
            r.type === '2>' || r.type === '2>>' || r.type === '&>' || r.type === '>&'
        );

        // Create stderr buffer for error redirection
        const stderrBuffer: string[] = [];

        // Execute with error handling based on whether stderr redirection is present
        let output = '';
        try {
            output = this.execSingleWithStderr(commandTokens, actualStdin, stderrBuffer);
        } catch (err: any) {
            if (hasStderrRedirection) {
                // If there's stderr redirection, capture the error message instead of throwing
                const errorMessage = err.message || String(err);
                stderrBuffer.push(errorMessage);
                output = '';
            } else {
                // If no stderr redirection, throw as usual (backward compatible)
                throw err;
            }
        }

        // Get stderr output
        const stderrOutput = stderrBuffer.join('\n');

        // Handle error redirections first (2>, 2>>, &>)
        const errorRedirect = redirections.find(r => r.type === '2>' || r.type === '2>>' || r.type === '&>');
        if (errorRedirect && 'target' in errorRedirect) {
            const node = this.fs.resolvePath(errorRedirect.target);
            if (node && !node.isFile()) {
                throw new Error(`${errorRedirect.target}: Is a directory`);
            }
            if (errorRedirect.type === '2>' || errorRedirect.type === '&>') {
                // Overwrite
                if (node && node.isFile()) {
                    node.write(stderrOutput);
                } else {
                    this.fs.createFile(errorRedirect.target, stderrOutput);
                }
            } else if (errorRedirect.type === '2>>') {
                // Append
                if (node && node.isFile()) {
                    const existingContent = node.read();
                    if (existingContent && existingContent.length > 0) {
                        node.append('\n' + stderrOutput);
                    } else {
                        node.append(stderrOutput);
                    }
                } else {
                    this.fs.createFile(errorRedirect.target, stderrOutput);
                }
            }
        }

        // Handle 2>&1 (redirect stderr to stdout)
        const hasRedirectStderrToStdout = redirections.some(r => {
            if ('target' in r && r.target === '&1') {
                return r.type === '2>';
            }
            return false;
        });

        if (hasRedirectStderrToStdout) {
            output = output + (output ? '\n' : '') + stderrOutput;
        }

        // Handle output redirections
        for (const redir of redirections) {
            if (redir.type === '>') {
                // Redirect stdout to file (overwrite)
                const node = this.fs.resolvePath(redir.target);
                if (node && !node.isFile()) {
                    throw new Error(`${redir.target}: Is a directory`);
                }
                if (node && node.isFile()) {
                    node.write(output);
                } else {
                    this.fs.createFile(redir.target, output);
                }
                output = ''; // Don't return output, it went to file
            } else if (redir.type === '>>') {
                // Redirect stdout to file (append)
                const node = this.fs.resolvePath(redir.target);
                if (node && !node.isFile()) {
                    throw new Error(`${redir.target}: Is a directory`);
                }
                if (node && node.isFile()) {
                    // Add newline before appending if file has content
                    const existingContent = node.read();
                    if (existingContent && existingContent.length > 0) {
                        node.append('\n' + output);
                    } else {
                        node.append(output);
                    }
                } else {
                    this.fs.createFile(redir.target, output);
                }
                output = ''; // Don't return output, it went to file
            }
        }

        return output;
    }

    /**
     * Execute a single command with stderr support
     */
    private execSingleWithStderr(commandTokens: string[], stdin: string | null = null, stderr: string[]): string {
        if (!commandTokens || commandTokens.length === 0) {
            return '';
        }

        const command = commandTokens[0];
        let args = commandTokens.slice(1);

        // Expand wildcards in arguments (use current working directory from fs)
        const cwd = this.fs.getCurrentDirectory();
        args = this.expandWildcards(args, cwd);

        // Create command context with stderr support
        const context: CommandContext = {
            fs: this.fs,
            jsEngine: this.jsEngine,
            session: this.session,
            stdin,
            stderr: stderr,
            parseArgsWithHelp: this.parseArgsWithHelp.bind(this),
            expandWildcards: this.expandWildcards.bind(this),
            getAllFilesRecursive: this.getAllFilesRecursive.bind(this),
        };

        // Try COMMANDS registry first
        if (COMMANDS[command]) {
            const def = COMMANDS[command];
            if (def.acceptsStdin && stdin !== null && stdin !== undefined) {
                return def.execute(context, args, stdin);
            }
            return def.execute(context, args);
        }

        throw new Error(`${command}: command not found`);
    }

    /**
     * Expand command substitutions $(command) in a string
     * Handles nested substitutions by processing from innermost to outermost
     */
    expandCommandSubstitutions(commandLine: string, depth: number = 0): string {
        // Prevent infinite recursion
        if (depth > 10) {
            return commandLine;
        }

        let result = commandLine;
        let hasSubstitution = true;

        // Keep expanding until no more substitutions are found
        while (hasSubstitution) {
            hasSubstitution = false;
            let i = 0;

            while (i < result.length) {
                // Look for $( pattern
                if (result[i] === '$' && result[i + 1] === '(') {
                    // Find the matching closing parenthesis
                    let depth = 1;
                    let j = i + 2;

                    while (j < result.length && depth > 0) {
                        if (result[j] === '(') depth++;
                        else if (result[j] === ')') depth--;
                        j++;
                    }

                    if (depth === 0) {
                        // Found a complete substitution
                        const command = result.substring(i + 2, j - 1);

                        try {
                            // Execute the command (without expanding substitutions again to avoid infinite loop)
                            // We'll handle this by tracking depth
                            let output: string;

                            // Check if the command itself has substitutions
                            if (command.includes('$(')) {
                                // Recursively expand nested substitutions first
                                const expandedCommand = this.expandCommandSubstitutions(command, depth + 1);
                                output = this.execWithoutSubstitution(expandedCommand);
                            } else {
                                output = this.execWithoutSubstitution(command);
                            }

                            // Remove trailing newline for substitution
                            output = output.replace(/\n$/, '');

                            // Replace the substitution with the output
                            result = result.substring(0, i) + output + result.substring(j);
                            hasSubstitution = true;

                            // Continue from where we inserted the output
                            i = i + output.length;
                        } catch (err: any) {
                            // If command fails, replace with empty string
                            result = result.substring(0, i) + result.substring(j);
                            hasSubstitution = true;
                        }
                    } else {
                        // Unmatched parenthesis, skip
                        i++;
                    }
                } else {
                    i++;
                }
            }
        }

        return result;
    }

    /**
     * Execute a command without expanding command substitutions
     * Used internally by expandCommandSubstitutions to avoid infinite recursion
     */
    private execWithoutSubstitution(commandLine: string): string {
        return this.execInternal(commandLine, false);
    }

    /**
     * Execute for loop: for variable in items; do commands; done
     */
    private execForLoop(variable: string, itemsExpr: string, loopBody: string, expandSubstitutions: boolean): string {
        // Expand the items expression (handles wildcards, command substitution, variables)
        let itemsStr = itemsExpr.trim();

        // If items expression contains wildcards or special chars, expand it
        if (itemsStr.includes('*') || itemsStr.includes('?') || itemsStr.includes('$')) {
            // Use echo to expand the expression
            try {
                itemsStr = this.execInternal(`echo ${itemsStr}`, expandSubstitutions).trim();
            } catch (e) {
                // If expansion fails, treat as literal
            }
        }

        // Split items by whitespace
        const items = itemsStr.split(/\s+/).filter(item => item.length > 0);
        const outputs: string[] = [];

        // Execute loop body for each item
        for (const item of items) {
            // Replace variable references in loop body
            // Handle both $variable and ${variable} forms
            const expandedBody = loopBody
                .replace(new RegExp(`\\$\\{${variable}\\}`, 'g'), item)
                .replace(new RegExp(`\\$${variable}\\b`, 'g'), item);

            try {
                const output = this.execInternal(expandedBody, expandSubstitutions);
                if (output) {
                    outputs.push(output);
                }
            } catch (e) {
                // Continue on error in loop iteration
                console.error(`Error in for loop iteration (${variable}=${item}):`, (e as Error).message);
            }
        }

        return outputs.join('\n');
    }

    /**
     * Execute a command
     */
    exec(commandLine: string): string {
        return this.execInternal(commandLine, true);
    }

    /**
     * Internal execute method with optional substitution expansion
     */
    private execInternal(commandLine: string, expandSubstitutions: boolean): string {
        if (!commandLine || !commandLine.trim()) {
            return '';
        }

        // Check for for loop syntax: for variable in items; do commands; done
        const forLoopMatch = /^\s*for\s+(\w+)\s+in\s+(.+?)\s*;\s*do\s+(.*?)\s*;\s*done\s*$/s.exec(commandLine.trim());
        if (forLoopMatch) {
            const variable = forLoopMatch[1];
            const itemsExpr = forLoopMatch[2];
            const loopBody = forLoopMatch[3];
            return this.execForLoop(variable, itemsExpr, loopBody, expandSubstitutions);
        }

        // Expand command substitutions $(...)
        if (expandSubstitutions) {
            commandLine = this.expandCommandSubstitutions(commandLine);
        }

        // Check for inline HEREDOC first (before tokenization)
        if (isInlineHeredoc(commandLine)) {
            const heredocInfo = parseInlineHeredoc(commandLine);
            if (heredocInfo) {
                // Execute HEREDOC command with its content
                const heredocOutput = this.execWithHeredoc(heredocInfo.command, heredocInfo.content);

                // Collect all redirections (both pre and post)
                const allRedirections = heredocInfo.preRedirects || [];

                // Check if there's a redirection on the same line as the HEREDOC delimiter
                if (heredocInfo.redirect) {
                    // Check if it's a pipe first
                    if (heredocInfo.redirect.trim().startsWith('|')) {
                        const remainingPipeline = heredocInfo.redirect.substring(heredocInfo.redirect.indexOf('|') + 1).trim();
                        if (remainingPipeline) {
                            const pipeline = parsePipeline(remainingPipeline);
                            // Convert to old format for execPipeline (array of token arrays)
                            const pipelineCommands = pipeline.map(cmd => cmd.command);
                            let output = this.execPipeline(pipelineCommands, heredocOutput);
                            // Apply pre-redirections after pipeline
                            for (const redir of allRedirections) {
                                if (redir.type === '>') {
                                    const node = this.fs.resolvePath(redir.target);
                                    if (node && !node.isFile()) {
                                        throw new Error(`${redir.target}: Is a directory`);
                                    }
                                    if (node && node.isFile()) {
                                        node.write(output);
                                    } else {
                                        this.fs.createFile(redir.target, output);
                                    }
                                    output = '';
                                } else if (redir.type === '>>') {
                                    const node = this.fs.resolvePath(redir.target);
                                    if (node && !node.isFile()) {
                                        throw new Error(`${redir.target}: Is a directory`);
                                    }
                                    if (node && node.isFile()) {
                                        // Add newline before appending if file has content
                                        const existingContent = node.read();
                                        if (existingContent && existingContent.length > 0) {
                                            node.append('\n' + output);
                                        } else {
                                            node.append(output);
                                        }
                                    } else {
                                        this.fs.createFile(redir.target, output);
                                    }
                                    output = '';
                                }
                            }
                            return output;
                        }
                    }

                    // Parse the redirection
                    const parsed = parsePipeline(heredocInfo.redirect);
                    const tokens = parsed.length > 0 ? parsed[0].command : [];
                    const { redirections } = parseRedirections(tokens);
                    allRedirections.push(...redirections);
                }

                // Apply all redirections to output
                let finalOutput = heredocOutput;
                for (const redir of allRedirections) {
                    if (redir.type === '>') {
                        const node = this.fs.resolvePath(redir.target);
                        if (node && !node.isFile()) {
                            throw new Error(`${redir.target}: Is a directory`);
                        }
                        if (node && node.isFile()) {
                            node.write(finalOutput);
                        } else {
                            this.fs.createFile(redir.target, finalOutput);
                        }
                        finalOutput = '';
                    } else if (redir.type === '>>') {
                        const node = this.fs.resolvePath(redir.target);
                        if (node && !node.isFile()) {
                            throw new Error(`${redir.target}: Is a directory`);
                        }
                        if (node && node.isFile()) {
                            // Add newline before appending if file has content
                            const existingContent = node.read();
                            if (existingContent && existingContent.length > 0) {
                                node.append('\n' + finalOutput);
                            } else {
                                node.append(finalOutput);
                            }
                        } else {
                            this.fs.createFile(redir.target, finalOutput);
                        }
                        finalOutput = '';
                    }
                }
                return finalOutput;
            }
        }

        // Parse command line with all operators
        const commands = parsePipeline(commandLine);

        // Handle multiple commands with operators
        if (commands.length > 1 || (commands.length === 1 && commands[0].type !== 'end')) {
            return this.execCommandSequence(commands);
        }

        // Single command without operators
        const { command, redirections } = parseRedirections(commands[0].command);

        // Check if there's a HEREDOC redirection
        const heredocRedirect = redirections.find(r => r.type === '<<');
        if (heredocRedirect) {
            // This shouldn't happen with inline HEREDOC, but handle it anyway
            throw new Error('HEREDOC requires multi-line input in interactive mode');
        }

        // Execute command with redirections
        if (redirections.length > 0) {
            return this.execWithRedirections(command, null, redirections);
        }

        // Execute single command without redirections
        return this.execSingle(command);
    }

    /**
     * Execute a sequence of commands with operators (&&, ||, ;, |)
     */
    execCommandSequence(commands: PipelineSegment[]): string {
        if (commands.length === 0) {
            return '';
        }

        let output: string | null = null;
        let lastExitCode = 0;

        for (let i = 0; i < commands.length; i++) {
            const { type, command: commandTokens } = commands[i];

            // Determine if we should execute this command
            let shouldExecute = true;

            if (i > 0) {
                const prevType = commands[i - 1].type;
                if (prevType === 'and') {
                    // && - execute only if previous succeeded (exit code 0)
                    shouldExecute = (lastExitCode === 0);
                } else if (prevType === 'or') {
                    // || - execute only if previous failed (exit code non-zero)
                    shouldExecute = (lastExitCode !== 0);
                }
                // For 'seq' (;) and 'pipe' (|), always execute
            }

            if (!shouldExecute) {
                // Skip this command but continue to next
                continue;
            }

            // Parse redirections from command tokens
            const { command, redirections } = parseRedirections(commandTokens);

            try {
                // Execute command based on type
                if (type === 'pipe' || (i > 0 && commands[i - 1].type === 'pipe')) {
                    // Pipe - pass output from previous command as stdin
                    if (redirections.length > 0) {
                        output = this.execWithRedirections(command, output, redirections);
                    } else {
                        output = this.execSingle(command, output);
                    }
                    lastExitCode = 0;
                } else {
                    // Non-pipe operators - execute independently
                    if (redirections.length > 0) {
                        output = this.execWithRedirections(command, null, redirections);
                    } else {
                        output = this.execSingle(command);
                    }
                    lastExitCode = 0;
                }
            } catch (error: any) {
                // Command failed
                lastExitCode = 1;

                // For seq (;), continue to next command
                if (type === 'seq' || type === 'end') {
                    output = error.message;
                } else if (type === 'or') {
                    // || - continue to next command on failure
                    output = error.message;
                } else if (type === 'and') {
                    // && - stop on failure
                    throw error;
                } else if (type === 'pipe') {
                    // | - stop on failure
                    throw error;
                } else {
                    throw error;
                }
            }
        }

        return output || '';
    }
}
