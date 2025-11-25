"use strict";
/**
 * cut - remove sections from each line of files
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cut = cut;
const argparse_1 = require("argparse");
function cut(context, args, stdin = null) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'cut',
        description: 'Remove sections from each line of files',
        add_help: true
    });
    parser.add_argument('-f', '--fields', {
        metavar: 'FIELDS',
        help: 'Select only these fields (e.g., 1,3 or 1-3)'
    });
    parser.add_argument('-d', '--delimiter', {
        default: '\t',
        metavar: 'DELIM',
        help: 'Use DELIM instead of TAB for field delimiter'
    });
    parser.add_argument('-c', '--characters', {
        metavar: 'CHARS',
        help: 'Select only these characters (e.g., 1,3 or 1-10)'
    });
    parser.add_argument('files', {
        nargs: '*',
        help: 'File(s) to read'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const fields = parsed.fields;
    const delimiter = parsed.delimiter;
    const characters = parsed.characters;
    const files = parsed.files || [];
    // Validate that either fields or characters is specified
    if (!fields && !characters) {
        throw new Error('cut: you must specify a list of bytes, characters, or fields');
    }
    // Parse field/character specification
    const parseSpecification = (spec) => {
        const ranges = [];
        const parts = spec.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(s => {
                    const num = parseInt(s.trim());
                    return isNaN(num) ? 1 : num;
                });
                ranges.push([start, end || Infinity]);
            }
            else {
                const num = parseInt(trimmed);
                if (!isNaN(num)) {
                    ranges.push(num);
                }
            }
        }
        return ranges;
    };
    const processLine = (line, specs) => {
        if (characters) {
            // Character-based cutting
            const result = [];
            const positions = new Set();
            for (const spec of specs) {
                if (typeof spec === 'number') {
                    positions.add(spec - 1); // Convert to 0-based
                }
                else {
                    const [start, end] = spec;
                    for (let i = start - 1; i < end && i < line.length; i++) {
                        positions.add(i);
                    }
                }
            }
            const sortedPositions = Array.from(positions).sort((a, b) => a - b);
            for (const pos of sortedPositions) {
                if (pos < line.length) {
                    result.push(line[pos]);
                }
            }
            return result.join('');
        }
        else {
            // Field-based cutting
            const parts = line.split(delimiter);
            const result = [];
            for (const spec of specs) {
                if (typeof spec === 'number') {
                    if (spec - 1 < parts.length) {
                        result.push(parts[spec - 1]);
                    }
                }
                else {
                    const [start, end] = spec;
                    for (let i = start - 1; i < end && i < parts.length; i++) {
                        result.push(parts[i]);
                    }
                }
            }
            return result.join(delimiter);
        }
    };
    const specs = characters
        ? parseSpecification(characters)
        : parseSpecification(fields || '');
    // If no files specified, read from stdin
    if (files.length === 0) {
        if (stdin === null) {
            throw new Error('cut: no input');
        }
        const lines = stdin.split('\n');
        return lines.map(line => processLine(line, specs)).join('\n');
    }
    // Read from files
    const results = [];
    for (const file of files) {
        const node = context.fs.resolvePath(file);
        if (!node) {
            throw new Error(`cut: ${file}: No such file or directory`);
        }
        if (!node.isFile()) {
            throw new Error(`cut: ${file}: Is a directory`);
        }
        const content = node.read();
        const lines = content.split('\n');
        results.push(lines.map(line => processLine(line, specs)).join('\n'));
    }
    return results.join('\n');
}
