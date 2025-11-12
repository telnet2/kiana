/**
 * grep - search for patterns in files
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function grep(context: CommandContext, args: string[], stdin: string | null = null): string {
    // Create argument parser for grep
    // Note: add_help is false because grep uses -h for --no-filename
    const parser = new ArgumentParser({
        prog: 'grep',
        description: 'Search for patterns in files',
        add_help: false
    });

    // Manually add --help (without -h short form since grep uses -h for --no-filename)
    parser.add_argument('--help', {
        action: 'help',
        help: 'Show this help message and exit'
    });

    // Add arguments
    parser.add_argument('-e', '--regexp', {
        action: 'append',
        dest: 'patterns',
        metavar: 'PATTERN',
        help: 'Pattern to search for (can be used multiple times)'
    });
    parser.add_argument('-i', '--ignore-case', {
        action: 'store_true',
        help: 'Ignore case distinctions'
    });
    parser.add_argument('-n', '--line-number', {
        action: 'store_true',
        help: 'Prefix each line with line number'
    });
    parser.add_argument('-v', '--invert-match', {
        action: 'store_true',
        help: 'Select non-matching lines'
    });
    parser.add_argument('-h', '--no-filename', {
        action: 'store_true',
        help: 'Suppress file name prefix'
    });
    parser.add_argument('-A', '--after-context', {
        type: 'int',
        default: 0,
        metavar: 'NUM',
        help: 'Print NUM lines of trailing context'
    });
    parser.add_argument('-B', '--before-context', {
        type: 'int',
        default: 0,
        metavar: 'NUM',
        help: 'Print NUM lines of leading context'
    });
    parser.add_argument('-C', '--context', {
        type: 'int',
        default: 0,
        metavar: 'NUM',
        help: 'Print NUM lines of context'
    });
    parser.add_argument('-R', '--recursive', {
        action: 'store_true',
        help: 'Search directories recursively'
    });
    parser.add_argument('rest', {
        nargs: '*',
        help: 'PATTERN and FILES (if -e not used)'
    });

    // Parse arguments
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // Extract pattern and files
    let patterns: string[] = parsed.patterns || [];
    let files: string[] = [];

    if (patterns.length === 0) {
        // No -e flag, first positional is pattern
        if (parsed.rest.length === 0) {
            throw new Error('grep: missing pattern');
        }
        patterns = [parsed.rest[0]];
        files = parsed.rest.slice(1);
    } else {
        // -e flag used, all positionals are files
        files = parsed.rest;
    }

    // Handle context flags (-C overrides -A and -B if set)
    const afterContext = parsed.context || parsed.after_context;
    const beforeContext = parsed.context || parsed.before_context;
    const suppressFilename = parsed.no_filename;
    const recursiveMode = parsed.recursive;

    // Helper function to search lines and return matches with context
    const searchLines = (lines: string[], filename: string | null = null): string[] => {
        const results: string[] = [];
        const matchedIndices = new Set<number>();
        const regexFlags = parsed.ignore_case ? 'i' : '';

        // Build regex patterns
        const regexes = patterns.map(p => new RegExp(p, regexFlags));

        // Find all matching lines
        lines.forEach((line, index) => {
            const matches = regexes.some(regex => {
                const result = regex.test(line);
                regex.lastIndex = 0; // Reset for global flag
                return result;
            });

            if (matches) {
                matchedIndices.add(index);
            }
        });

        // Expand to include context lines
        const outputIndices = new Set<number>();
        matchedIndices.forEach(index => {
            // Add before context
            for (let i = Math.max(0, index - beforeContext); i < index; i++) {
                outputIndices.add(i);
            }
            // Add match line
            outputIndices.add(index);
            // Add after context
            for (let i = index + 1; i <= Math.min(lines.length - 1, index + afterContext); i++) {
                outputIndices.add(i);
            }
        });

        // Sort indices and build output
        const sortedIndices = Array.from(outputIndices).sort((a, b) => a - b);
        let lastIndex = -2;

        sortedIndices.forEach(index => {
            // Add separator for non-contiguous lines
            if (lastIndex >= 0 && index > lastIndex + 1) {
                results.push('--');
            }

            const line = lines[index];
            const isMatch = matchedIndices.has(index);
            const lineNumPrefix = parsed.line_number ? `${index + 1}${isMatch ? ':' : '-'}` : '';
            const filePrefix = (filename && !suppressFilename) ? `${filename}${isMatch ? ':' : '-'}` : '';

            results.push(`${filePrefix}${lineNumPrefix}${line}`);
            lastIndex = index;
        });

        return results;
    };

    // If no files and stdin is available, use stdin
    if (files.length === 0 && stdin !== null && stdin !== undefined) {
        const content = stdin;
        const lines = content.split('\n');
        const results = searchLines(lines, null);
        return results.join('\n');
    }

    if (files.length === 0) {
        throw new Error('grep: missing file operand');
    }

    const allResults: string[] = [];

    // Collect all files to process (handle -R for recursive)
    let filesToProcess: string[] = [];

    if (recursiveMode) {
        // Expand directories recursively
        for (const pathStr of files) {
            const node = context.fs.resolvePath(pathStr);
            if (!node) {
                allResults.push(`grep: ${pathStr}: No such file or directory`);
                continue;
            }

            if (node.isFile()) {
                filesToProcess.push(pathStr);
            } else if (node.isDirectory()) {
                // Get all files recursively from this directory
                const recursiveFiles = context.getAllFilesRecursive(pathStr);
                filesToProcess.push(...recursiveFiles.map(f => {
                    const basePath = pathStr.endsWith('/') ? pathStr : pathStr + '/';
                    return basePath + f;
                }));
            }
        }
    } else {
        filesToProcess = files;
    }

    for (const pathStr of filesToProcess) {
        const node = context.fs.resolvePath(pathStr);
        if (!node) {
            allResults.push(`grep: ${pathStr}: No such file or directory`);
            continue;
        }
        if (!node.isFile()) {
            allResults.push(`grep: ${pathStr}: Is a directory`);
            continue;
        }

        const content = node.read();
        const lines = content.split('\n');

        // Determine if we should show filename (multiple files or recursive mode, unless -h)
        const showFilename = (filesToProcess.length > 1 || recursiveMode) && !suppressFilename;
        const filename = showFilename ? pathStr : null;

        const results = searchLines(lines, filename);

        if (results.length > 0) {
            allResults.push(results.join('\n'));
        }
    }

    return allResults.join('\n');
}
