"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemShell = void 0;
const MemFS_1 = require("./MemFS");
const JSEngine_1 = require("./JSEngine");
const CommandParser_1 = require("./CommandParser");
const micromatch = require("micromatch");
const commands_1 = require("./commands");
const MemSession_1 = require("./MemSession");
/**
 * Shell-like command interface for MemFS
 */
class MemShell {
    constructor(memfs = null, session = null) {
        this.fs = memfs || new MemFS_1.MemFS();
        this.stdin = null;
        this.jsEngine = new JSEngine_1.JSEngine(this.fs);
        this.session = session || new MemSession_1.MemSession();
    }
    /**
     * Safely parse arguments with ArgumentParser without exiting process
     * Returns help text for -h/--help, throws error for invalid args
     */
    safeParseArgs(parser, args) {
        // Save original process.exit and stream writes
        const originalExit = process.exit;
        const originalStdoutWrite = process.stdout.write;
        const originalStderrWrite = process.stderr.write;
        let exitCalled = false;
        let exitCode = 0;
        let capturedOutput = '';
        // Override process.exit to capture exit attempts
        process.exit = (code) => {
            exitCalled = true;
            exitCode = code;
            throw new Error('__EXIT__');
        };
        // Override stdout.write to capture output
        process.stdout.write = function (chunk) {
            capturedOutput += chunk.toString();
            return true;
        };
        // Override stderr.write to capture errors
        process.stderr.write = function (chunk) {
            capturedOutput += chunk.toString();
            return true;
        };
        try {
            const result = parser.parse_args(args);
            return result;
        }
        catch (err) {
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
        }
        finally {
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
    parseArgsWithHelp(parser, args) {
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
    expandWildcards(args, cwd = '/') {
        const expanded = [];
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
                }
                else if (arg.includes('/')) {
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
                    matches.forEach((match) => {
                        if (baseDir === '/') {
                            expanded.push('/' + match);
                        }
                        else {
                            expanded.push(baseDir + '/' + match);
                        }
                    });
                }
                else {
                    // No matches - keep the original pattern
                    expanded.push(arg);
                }
            }
            else {
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
    getAllFilesRecursive(dirPath) {
        const files = [];
        const node = this.fs.resolvePath(dirPath);
        if (!node || !node.isDirectory()) {
            return files;
        }
        const traverse = (dir, relativePath = '') => {
            // children is a Map, not a plain object
            for (const [name, child] of Array.from(dir.children.entries())) {
                const childPath = relativePath ? `${relativePath}/${name}` : name;
                if (child.isFile()) {
                    files.push(childPath);
                }
                else if (child.isDirectory()) {
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
    parseArgs(args) {
        const flags = {};
        const positional = [];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const key = arg.slice(2);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('-')) {
                    flags[key] = nextArg;
                    i++;
                }
                else {
                    flags[key] = true;
                }
            }
            else if (arg.startsWith('-') && arg.length > 1 && !arg.match(/^-\d/)) {
                for (let j = 1; j < arg.length; j++) {
                    flags[arg[j]] = true;
                }
            }
            else {
                positional.push(arg);
            }
        }
        return { flags, positional };
    }
    /**
     * Execute a single command with optional stdin
     */
    execSingle(commandTokens, stdin = null) {
        if (!commandTokens || commandTokens.length === 0) {
            return '';
        }
        const command = commandTokens[0];
        let args = commandTokens.slice(1);
        // Expand wildcards in arguments (use current working directory from fs)
        const cwd = this.fs.getCurrentDirectory();
        args = this.expandWildcards(args, cwd);
        // Create command context for extracted commands
        const context = {
            fs: this.fs,
            jsEngine: this.jsEngine,
            session: this.session,
            stdin,
            parseArgsWithHelp: this.parseArgsWithHelp.bind(this),
            expandWildcards: this.expandWildcards.bind(this),
            getAllFilesRecursive: this.getAllFilesRecursive.bind(this),
        };
        // Try COMMANDS registry first
        if (commands_1.COMMANDS[command]) {
            const def = commands_1.COMMANDS[command];
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
    execPipeline(pipeline, initialStdin = null) {
        if (pipeline.length === 0) {
            return '';
        }
        let output = initialStdin;
        for (let i = 0; i < pipeline.length; i++) {
            const commandTokens = pipeline[i];
            // Parse redirections from command tokens
            const { command, redirections } = (0, CommandParser_1.parseRedirections)(commandTokens);
            // Execute command
            if (redirections.length > 0) {
                output = this.execWithRedirections(command, output, redirections);
            }
            else {
                output = this.execSingle(command, output);
            }
        }
        return output || '';
    }
    /**
     * Execute a command with HEREDOC support
     */
    execWithHeredoc(command, content) {
        // Parse the command
        const tokens = command.trim().split(/\s+/);
        const cmd = tokens[0];
        const args = tokens.slice(1);
        // Use COMMANDS registry for all commands
        if (!commands_1.COMMANDS[cmd]) {
            throw new Error(`${cmd}: command not found or does not support HEREDOC`);
        }
        const context = {
            fs: this.fs,
            jsEngine: this.jsEngine,
            session: this.session,
            stdin: content,
            parseArgsWithHelp: this.parseArgsWithHelp.bind(this),
            expandWildcards: this.expandWildcards.bind(this),
            getAllFilesRecursive: this.getAllFilesRecursive.bind(this),
        };
        const def = commands_1.COMMANDS[cmd];
        if (def.acceptsStdin) {
            return def.execute(context, args, content);
        }
        // For commands that don't accept stdin, execute normally
        return def.execute(context, args);
    }
    /**
     * Execute a command with redirections
     */
    execWithRedirections(commandTokens, stdin = null, redirections = []) {
        // Find HEREDOC redirection
        const heredocRedirect = redirections.find(r => r.type === '<<');
        let actualStdin = stdin;
        // If there's a HEREDOC, it becomes the stdin
        if (heredocRedirect && 'delimiter' in heredocRedirect) {
            // For HEREDOC in interactive mode, content will be provided separately
            // This is just marking that we expect HEREDOC input
            actualStdin = stdin;
        }
        // Execute the command
        let output = this.execSingle(commandTokens, actualStdin);
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
                }
                else {
                    this.fs.createFile(redir.target, output);
                }
                output = ''; // Don't return output, it went to file
            }
            else if (redir.type === '>>') {
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
                    }
                    else {
                        node.append(output);
                    }
                }
                else {
                    this.fs.createFile(redir.target, output);
                }
                output = ''; // Don't return output, it went to file
            }
        }
        return output;
    }
    /**
     * Expand command substitutions $(command) in a string
     * Handles nested substitutions by processing from innermost to outermost
     */
    expandCommandSubstitutions(commandLine, depth = 0) {
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
                        if (result[j] === '(')
                            depth++;
                        else if (result[j] === ')')
                            depth--;
                        j++;
                    }
                    if (depth === 0) {
                        // Found a complete substitution
                        const command = result.substring(i + 2, j - 1);
                        try {
                            // Execute the command (without expanding substitutions again to avoid infinite loop)
                            // We'll handle this by tracking depth
                            let output;
                            // Check if the command itself has substitutions
                            if (command.includes('$(')) {
                                // Recursively expand nested substitutions first
                                const expandedCommand = this.expandCommandSubstitutions(command, depth + 1);
                                output = this.execWithoutSubstitution(expandedCommand);
                            }
                            else {
                                output = this.execWithoutSubstitution(command);
                            }
                            // Remove trailing newline for substitution
                            output = output.replace(/\n$/, '');
                            // Replace the substitution with the output
                            result = result.substring(0, i) + output + result.substring(j);
                            hasSubstitution = true;
                            // Continue from where we inserted the output
                            i = i + output.length;
                        }
                        catch (err) {
                            // If command fails, replace with empty string
                            result = result.substring(0, i) + result.substring(j);
                            hasSubstitution = true;
                        }
                    }
                    else {
                        // Unmatched parenthesis, skip
                        i++;
                    }
                }
                else {
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
    execWithoutSubstitution(commandLine) {
        return this.execInternal(commandLine, false);
    }
    /**
     * Execute a command
     */
    exec(commandLine) {
        return this.execInternal(commandLine, true);
    }
    /**
     * Internal execute method with optional substitution expansion
     */
    execInternal(commandLine, expandSubstitutions) {
        if (!commandLine || !commandLine.trim()) {
            return '';
        }
        // Expand command substitutions $(...)
        if (expandSubstitutions) {
            commandLine = this.expandCommandSubstitutions(commandLine);
        }
        // Check for inline HEREDOC first (before tokenization)
        if ((0, CommandParser_1.isInlineHeredoc)(commandLine)) {
            const heredocInfo = (0, CommandParser_1.parseInlineHeredoc)(commandLine);
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
                            const pipeline = (0, CommandParser_1.parsePipeline)(remainingPipeline);
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
                                    }
                                    else {
                                        this.fs.createFile(redir.target, output);
                                    }
                                    output = '';
                                }
                                else if (redir.type === '>>') {
                                    const node = this.fs.resolvePath(redir.target);
                                    if (node && !node.isFile()) {
                                        throw new Error(`${redir.target}: Is a directory`);
                                    }
                                    if (node && node.isFile()) {
                                        // Add newline before appending if file has content
                                        const existingContent = node.read();
                                        if (existingContent && existingContent.length > 0) {
                                            node.append('\n' + output);
                                        }
                                        else {
                                            node.append(output);
                                        }
                                    }
                                    else {
                                        this.fs.createFile(redir.target, output);
                                    }
                                    output = '';
                                }
                            }
                            return output;
                        }
                    }
                    // Parse the redirection
                    const parsed = (0, CommandParser_1.parsePipeline)(heredocInfo.redirect);
                    const tokens = parsed.length > 0 ? parsed[0].command : [];
                    const { redirections } = (0, CommandParser_1.parseRedirections)(tokens);
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
                        }
                        else {
                            this.fs.createFile(redir.target, finalOutput);
                        }
                        finalOutput = '';
                    }
                    else if (redir.type === '>>') {
                        const node = this.fs.resolvePath(redir.target);
                        if (node && !node.isFile()) {
                            throw new Error(`${redir.target}: Is a directory`);
                        }
                        if (node && node.isFile()) {
                            // Add newline before appending if file has content
                            const existingContent = node.read();
                            if (existingContent && existingContent.length > 0) {
                                node.append('\n' + finalOutput);
                            }
                            else {
                                node.append(finalOutput);
                            }
                        }
                        else {
                            this.fs.createFile(redir.target, finalOutput);
                        }
                        finalOutput = '';
                    }
                }
                return finalOutput;
            }
        }
        // Parse command line with all operators
        const commands = (0, CommandParser_1.parsePipeline)(commandLine);
        // Handle multiple commands with operators
        if (commands.length > 1 || (commands.length === 1 && commands[0].type !== 'end')) {
            return this.execCommandSequence(commands);
        }
        // Single command without operators
        const { command, redirections } = (0, CommandParser_1.parseRedirections)(commands[0].command);
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
    execCommandSequence(commands) {
        if (commands.length === 0) {
            return '';
        }
        let output = null;
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
                }
                else if (prevType === 'or') {
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
            const { command, redirections } = (0, CommandParser_1.parseRedirections)(commandTokens);
            try {
                // Execute command based on type
                if (type === 'pipe' || (i > 0 && commands[i - 1].type === 'pipe')) {
                    // Pipe - pass output from previous command as stdin
                    if (redirections.length > 0) {
                        output = this.execWithRedirections(command, output, redirections);
                    }
                    else {
                        output = this.execSingle(command, output);
                    }
                    lastExitCode = 0;
                }
                else {
                    // Non-pipe operators - execute independently
                    if (redirections.length > 0) {
                        output = this.execWithRedirections(command, null, redirections);
                    }
                    else {
                        output = this.execSingle(command);
                    }
                    lastExitCode = 0;
                }
            }
            catch (error) {
                // Command failed
                lastExitCode = 1;
                // For seq (;), continue to next command
                if (type === 'seq' || type === 'end') {
                    output = error.message;
                }
                else if (type === 'or') {
                    // || - continue to next command on failure
                    output = error.message;
                }
                else if (type === 'and') {
                    // && - stop on failure
                    throw error;
                }
                else if (type === 'pipe') {
                    // | - stop on failure
                    throw error;
                }
                else {
                    throw error;
                }
            }
        }
        return output || '';
    }
}
exports.MemShell = MemShell;
