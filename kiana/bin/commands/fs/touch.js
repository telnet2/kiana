"use strict";
/**
 * touch - create empty file or update timestamp
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.touch = touch;
const argparse_1 = require("argparse");
function touch(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'touch',
        description: 'Create empty file or update timestamp',
        add_help: true
    });
    parser.add_argument('files', {
        nargs: '+',
        help: 'Files to touch'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    for (const pathStr of parsed.files) {
        const node = context.fs.resolvePath(pathStr);
        if (node) {
            node.modifiedAt = new Date();
        }
        else {
            context.fs.createFile(pathStr, '');
        }
    }
    return '';
}
