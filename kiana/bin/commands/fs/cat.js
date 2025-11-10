"use strict";
/**
 * cat - concatenate and display file contents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cat = cat;
const argparse_1 = require("argparse");
function cat(context, args, stdin = null) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'cat',
        description: 'Concatenate and display files',
        add_help: true
    });
    parser.add_argument('-n', '--number', {
        action: 'store_true',
        help: 'Number all output lines'
    });
    parser.add_argument('files', {
        nargs: '*',
        help: 'Files to concatenate (use - for stdin)'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    // If no files specified and stdin is available, use stdin
    if (parsed.files.length === 0) {
        if (stdin !== null && stdin !== undefined) {
            return numberLines(stdin, parsed.number);
        }
        throw new Error('cat: missing file operand');
    }
    const outputs = [];
    for (const pathStr of parsed.files) {
        // Support "-" to read from stdin
        if (pathStr === '-' && stdin !== null && stdin !== undefined) {
            outputs.push(stdin);
            continue;
        }
        const node = context.fs.resolvePath(pathStr);
        if (!node) {
            throw new Error(`cat: ${pathStr}: No such file or directory`);
        }
        if (!node.isFile()) {
            throw new Error(`cat: ${pathStr}: Is a directory`);
        }
        outputs.push(node.read());
    }
    const result = outputs.join('');
    return numberLines(result, parsed.number);
}
function numberLines(content, shouldNumber) {
    if (!shouldNumber)
        return content;
    const lines = content.split('\n');
    return lines.map((line, i) => `${(i + 1).toString().padStart(6)}  ${line}`).join('\n');
}
