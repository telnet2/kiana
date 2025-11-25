"use strict";
/**
 * uniq - report or filter out repeated lines in a file
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniq = uniq;
const argparse_1 = require("argparse");
function uniq(context, args, stdin = null) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'uniq',
        description: 'Report or filter out repeated lines in a file',
        add_help: true
    });
    parser.add_argument('-c', '--count', {
        action: 'store_true',
        help: 'Prefix lines with the number of occurrences'
    });
    parser.add_argument('-d', '--repeated', {
        action: 'store_true',
        help: 'Only output lines that are repeated in the input'
    });
    parser.add_argument('-u', '--unique', {
        action: 'store_true',
        help: 'Only output lines that are not repeated in the input'
    });
    parser.add_argument('-i', '--ignore-case', {
        action: 'store_true',
        help: 'Ignore case differences'
    });
    parser.add_argument('-f', '--skip-fields', {
        type: 'int',
        default: 0,
        metavar: 'NUM',
        help: 'Skip first NUM fields when comparing'
    });
    parser.add_argument('input_file', {
        nargs: '?',
        help: 'Input file (if not specified, use stdin)'
    });
    parser.add_argument('output_file', {
        nargs: '?',
        help: 'Output file (not used in memfs, for compatibility only)'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const countOccurrences = parsed.count;
    const onlyRepeated = parsed.repeated;
    const onlyUnique = parsed.unique;
    const ignoreCase = parsed.ignore_case;
    const skipFields = parsed.skip_fields;
    const inputFile = parsed.input_file;
    // If both repeated and unique are specified, it's an error
    if (onlyRepeated && onlyUnique) {
        throw new Error('uniq: cannot specify both -d and -u');
    }
    let lines = [];
    // Get input
    if (inputFile) {
        const node = context.fs.resolvePath(inputFile);
        if (!node) {
            throw new Error(`uniq: ${inputFile}: No such file or directory`);
        }
        if (!node.isFile()) {
            throw new Error(`uniq: ${inputFile}: Is a directory`);
        }
        const content = node.read();
        lines = content.split('\n');
    }
    else {
        if (stdin === null) {
            throw new Error('uniq: no input');
        }
        lines = stdin.split('\n');
    }
    // Function to extract comparison key from line
    const getComparisonKey = (line) => {
        let key = line;
        // Skip fields if requested
        if (skipFields > 0) {
            const parts = key.split(/\s+/);
            key = parts.slice(skipFields).join(' ');
        }
        // Ignore case if requested
        if (ignoreCase) {
            key = key.toLowerCase();
        }
        return key;
    };
    // Count occurrences
    const occurrences = new Map();
    for (const line of lines) {
        const key = getComparisonKey(line);
        if (occurrences.has(key)) {
            occurrences.get(key).count++;
        }
        else {
            occurrences.set(key, { count: 1, originalLine: line });
        }
    }
    // Generate output
    const result = [];
    for (const [_key, { count, originalLine }] of occurrences) {
        let shouldInclude = false;
        if (onlyRepeated) {
            shouldInclude = count > 1;
        }
        else if (onlyUnique) {
            shouldInclude = count === 1;
        }
        else {
            shouldInclude = true;
        }
        if (shouldInclude) {
            if (countOccurrences) {
                result.push(`${count} ${originalLine}`);
            }
            else {
                result.push(originalLine);
            }
        }
    }
    return result.join('\n');
}
