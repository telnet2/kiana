"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.write = write;
const argparse_1 = require("argparse");
function write(context, args, stdin = null) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'write',
        description: 'Write text to a file',
        add_help: true,
    });
    parser.add_argument('file', { help: 'File to write to' });
    parser.add_argument('content', { nargs: '*', help: 'Content to write (or use stdin)' });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const filePath = parsed.file;
    // Use stdin if available and no content args provided
    let content;
    if (stdin !== null && stdin !== undefined && parsed.content.length === 0) {
        content = stdin;
    }
    else if (parsed.content.length > 0) {
        content = parsed.content.join(' ');
    }
    else {
        throw new Error('write: missing content (provide as arguments or via stdin)');
    }
    const node = context.fs.resolvePath(filePath);
    if (node) {
        if (!node.isFile()) {
            throw new Error(`write: ${filePath}: Is a directory`);
        }
        node.write(content);
    }
    else {
        context.fs.createFile(filePath, content);
    }
    return '';
}
