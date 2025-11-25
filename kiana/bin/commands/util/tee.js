"use strict";
/**
 * tee - split output to file and stdout
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tee = tee;
const argparse_1 = require("argparse");
function tee(context, args, stdin = null) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'tee',
        description: 'Split output to file and stdout',
        add_help: true
    });
    parser.add_argument('-a', '--append', {
        action: 'store_true',
        help: 'Append to files instead of overwriting'
    });
    parser.add_argument('-i', '--ignore-interrupts', {
        action: 'store_true',
        help: 'Ignore interrupt signals (for compatibility)'
    });
    parser.add_argument('files', {
        nargs: '*',
        help: 'Files to write to'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    // tee requires stdin
    if (stdin === null || stdin === undefined) {
        throw new Error('tee: no input provided');
    }
    const files = parsed.files;
    const append = parsed.append;
    // Write to all files
    for (const filePath of files) {
        const node = context.fs.resolvePath(filePath);
        if (append && node && node.isFile()) {
            // Append mode
            const existingContent = node.read();
            if (existingContent && existingContent.length > 0) {
                node.append('\n' + stdin);
            }
            else {
                node.append(stdin);
            }
        }
        else {
            // Overwrite mode
            if (node && !node.isFile()) {
                throw new Error(`tee: ${filePath}: Is a directory`);
            }
            if (node && node.isFile()) {
                node.write(stdin);
            }
            else {
                context.fs.createFile(filePath, stdin);
            }
        }
    }
    // Return stdin to stdout (that's what tee does)
    return stdin;
}
