/**
 * jqn - JSON query processor using jq syntax
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';
import { spawnSync } from 'child_process';

export function jqn(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'jqn',
        description: 'JSON query processor using jq syntax',
        add_help: true
    });

    parser.add_argument('filter', {
        nargs: '?',
        default: '.',
        help: 'jq filter expression (default: ".")'
    });
    parser.add_argument('files', {
        nargs: '*',
        help: 'JSON files to process (use - for stdin)'
    });
    parser.add_argument('-r', '--raw-output', {
        action: 'store_true',
        dest: 'raw',
        help: 'Output raw text instead of JSON'
    });
    parser.add_argument('-c', '--compact-output', {
        action: 'store_true',
        dest: 'compact',
        help: 'Compact output (no pretty-printing)'
    });
    parser.add_argument('-s', '--slurp', {
        action: 'store_true',
        help: 'Read entire input stream into array'
    });
    parser.add_argument('-n', '--null-input', {
        action: 'store_true',
        dest: 'null_input',
        help: 'Use null as input (useful with jq expressions that generate data)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const filter = parsed.filter;
    const files = parsed.files || [];

    let inputData: any;

    // Determine input source
    if (parsed.null_input) {
        inputData = null;
    } else if (files.length === 0) {
        // No files specified, use stdin
        if (stdin === null || stdin === undefined) {
            throw new Error('jqn: no input provided (use files, stdin, or --null-input)');
        }
        try {
            inputData = JSON.parse(stdin);
        } catch (err: any) {
            throw new Error(`jqn: invalid JSON in stdin: ${err.message}`);
        }
    } else {
        // Read from files
        const inputs: any[] = [];
        for (const filePath of files) {
            let content: string;
            
            // Support "-" to read from stdin
            if (filePath === '-') {
                if (stdin === null || stdin === undefined) {
                    throw new Error('jqn: stdin is empty but "-" was specified');
                }
                content = stdin;
            } else {
                const node = context.fs.resolvePath(filePath);
                if (!node) {
                    throw new Error(`jqn: ${filePath}: No such file or directory`);
                }
                if (!node.isFile()) {
                    throw new Error(`jqn: ${filePath}: Is a directory`);
                }
                content = node.read();
            }

            try {
                inputs.push(JSON.parse(content));
            } catch (err: any) {
                throw new Error(`jqn: ${filePath}: invalid JSON: ${err.message}`);
            }
        }

        // If slurp mode, wrap all inputs in an array
        if (parsed.slurp) {
            inputData = inputs;
        } else if (inputs.length === 1) {
            inputData = inputs[0];
        } else {
            // Multiple files without slurp - process each separately using jq via stdin
            const results: string[] = [];
            for (const input of inputs) {
                const jqArgs: string[] = [];
                if (parsed.raw) jqArgs.push('-r');
                if (parsed.compact) jqArgs.push('-c');
                else jqArgs.push('-M');
                
                jqArgs.push(filter);
                
                const result = spawnSync('jq', jqArgs, {
                    input: JSON.stringify(input),
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                
                if (result.status !== 0 && result.stderr) {
                    throw new Error(`jqn: ${result.stderr.trim()}`);
                }
                
                results.push(result.stdout.trimEnd());
            }
            return results.join('\n');
        }
    }

    // Apply jq filter using stdin/stdout
    // Build jq command arguments
    const jqArgs: string[] = [];
    
    if (parsed.raw) {
        jqArgs.push('-r');
    }
    if (parsed.compact) {
        jqArgs.push('-c');
    } else {
        // Pretty print by default
        jqArgs.push('-M');  // Monochrome (disable colors)
    }
    if (parsed.slurp) {
        jqArgs.push('-s');
    }
    
    jqArgs.push(filter);
    
    // Run jq synchronously with stdin
    const result = spawnSync('jq', jqArgs, {
        input: JSON.stringify(inputData),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (result.error) {
        throw new Error(`jqn: failed to execute jq: ${(result.error as any).message}`);
    }
    
    if (result.status !== 0 && result.stderr) {
        throw new Error(`jqn: ${result.stderr.trim()}`);
    }
    
    return result.stdout.trimEnd();
}
