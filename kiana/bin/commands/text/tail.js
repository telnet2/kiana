"use strict";
/**
 * tail - output the last part of files
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tail = tail;
const argparse_1 = require("argparse");
function tail(context, args, stdin = null) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'tail',
        description: 'Output the last part of files',
        add_help: true
    });
    parser.add_argument('-n', '--lines', {
        type: 'int',
        default: 10,
        metavar: 'NUM',
        help: 'Print last NUM lines (default: 10)'
    });
    parser.add_argument('-c', '--bytes', {
        type: 'int',
        metavar: 'NUM',
        help: 'Print last NUM bytes'
    });
    parser.add_argument('files', {
        nargs: '*',
        help: 'File(s) to read'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const numLines = parsed.lines;
    const numBytes = parsed.bytes;
    const files = parsed.files || [];
    // If no files specified, read from stdin
    if (files.length === 0) {
        if (stdin === null) {
            throw new Error('tail: no input');
        }
        if (numBytes !== undefined) {
            return stdin.substring(Math.max(0, stdin.length - numBytes));
        }
        else {
            const lines = stdin.split('\n');
            const start = Math.max(0, lines.length - numLines);
            return lines.slice(start).join('\n');
        }
    }
    // Read from files
    const results = [];
    for (const file of files) {
        const node = context.fs.resolvePath(file);
        if (!node) {
            throw new Error(`tail: ${file}: No such file or directory`);
        }
        if (!node.isFile()) {
            throw new Error(`tail: ${file}: Is a directory`);
        }
        const content = node.read();
        if (numBytes !== undefined) {
            results.push(content.substring(Math.max(0, content.length - numBytes)));
        }
        else {
            const lines = content.split('\n');
            const start = Math.max(0, lines.length - numLines);
            results.push(lines.slice(start).join('\n'));
        }
    }
    return results.join('\n');
}
