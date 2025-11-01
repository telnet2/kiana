/**
 * wc - word count and line/character statistics
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function wc(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'wc',
        description: 'Count lines, words, and characters in files',
        add_help: true
    });

    parser.add_argument('-l', '--lines', {
        action: 'store_true',
        help: 'Count lines only'
    });
    parser.add_argument('-w', '--words', {
        action: 'store_true',
        help: 'Count words only'
    });
    parser.add_argument('-c', '--bytes', {
        action: 'store_true',
        help: 'Count bytes/characters only'
    });
    parser.add_argument('-m', '--chars', {
        action: 'store_true',
        help: 'Count characters only'
    });
    parser.add_argument('-L', '--max-line-length', {
        action: 'store_true',
        dest: 'max_length',
        help: 'Print maximum line length'
    });
    parser.add_argument('files', {
        nargs: '*',
        help: 'Files to count (uses stdin if none provided)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const files = parsed.files || [];
    const countLines = parsed.lines || false;
    const countWords = parsed.words || false;
    const countBytes = parsed.bytes || false;
    const countChars = parsed.chars || false;
    const showMaxLength = parsed.max_length || false;

    // If no options specified, show all three (lines, words, bytes)
    const showAll = !countLines && !countWords && !countBytes && !countChars && !showMaxLength;

    let results: string[] = [];
    let totalLines = 0;
    let totalWords = 0;
    let totalBytes = 0;
    let totalChars = 0;
    let maxLineLength = 0;
    let fileCount = 0;

    try {
        // If no files, read from stdin
        if (files.length === 0) {
            if (stdin === null || stdin === undefined) {
                return '';
            }

            const stats = countString(stdin, showAll, countLines, countWords, countBytes, countChars, showMaxLength);
            totalLines += stats.lines;
            totalWords += stats.words;
            totalBytes += stats.bytes;
            totalChars += stats.chars;
            maxLineLength = Math.max(maxLineLength, stats.maxLength);
            results.push(formatOutput(stats, '', showAll, countLines, countWords, countBytes, countChars, showMaxLength));
        } else {
            // Process each file
            for (const filePath of files) {
                const node = context.fs.resolvePath(filePath);
                if (!node) {
                    throw new Error(`wc: ${filePath}: No such file or directory`);
                }
                if (!node.isFile()) {
                    throw new Error(`wc: ${filePath}: Is a directory`);
                }

                const content = node.read();
                const stats = countString(content, showAll, countLines, countWords, countBytes, countChars, showMaxLength);
                totalLines += stats.lines;
                totalWords += stats.words;
                totalBytes += stats.bytes;
                totalChars += stats.chars;
                maxLineLength = Math.max(maxLineLength, stats.maxLength);
                fileCount++;

                results.push(formatOutput(stats, filePath, showAll, countLines, countWords, countBytes, countChars, showMaxLength));
            }

            // Add totals if multiple files
            if (files.length > 1) {
                const totals = {
                    lines: totalLines,
                    words: totalWords,
                    bytes: totalBytes,
                    chars: totalChars,
                    maxLength: maxLineLength
                };
                results.push(formatOutput(totals, 'total', showAll, countLines, countWords, countBytes, countChars, showMaxLength));
            }
        }

        return results.join('\n');
    } catch (err: any) {
        throw new Error(`wc: ${err.message}`);
    }
}

interface CountStats {
    lines: number;
    words: number;
    bytes: number;
    chars: number;
    maxLength: number;
}

function countString(
    content: string,
    showAll: boolean,
    countLines: boolean,
    countWords: boolean,
    countBytes: boolean,
    countChars: boolean,
    showMaxLength: boolean
): CountStats {
    // Count lines
    const lines = content === '' ? 0 : content.split('\n').length;

    // Count words
    const words = content
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0).length;

    // Count bytes
    const bytes = Buffer.byteLength(content, 'utf8');

    // Count characters
    const chars = content.length;

    // Find max line length
    const lineArray = content.split('\n');
    let maxLength = 0;
    for (const line of lineArray) {
        maxLength = Math.max(maxLength, line.length);
    }

    return { lines, words, bytes, chars, maxLength };
}

function formatOutput(
    stats: CountStats,
    filePath: string,
    showAll: boolean,
    countLines: boolean,
    countWords: boolean,
    countBytes: boolean,
    countChars: boolean,
    showMaxLength: boolean
): string {
    const parts: string[] = [];

    if (showAll || countLines) {
        parts.push(String(stats.lines).padStart(7));
    }
    if (showAll || countWords) {
        parts.push(String(stats.words).padStart(7));
    }
    if (showAll || countBytes) {
        parts.push(String(stats.bytes).padStart(7));
    }
    if (countChars) {
        parts.push(String(stats.chars).padStart(7));
    }
    if (showMaxLength) {
        parts.push(String(stats.maxLength).padStart(7));
    }

    if (filePath) {
        parts.push(filePath);
    }

    return parts.join(' ').trim();
}
