"use strict";
/**
 * rm - remove files or directories
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rm = rm;
const argparse_1 = require("argparse");
function rm(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'rm',
        description: 'Remove files or directories',
        add_help: true
    });
    parser.add_argument('-r', {
        dest: 'recursive',
        action: 'store_true',
        help: 'Remove directories recursively'
    });
    parser.add_argument('-R', '--recursive', {
        action: 'store_true',
        help: 'Remove directories recursively'
    });
    parser.add_argument('-f', '--force', {
        action: 'store_true',
        help: 'Ignore nonexistent files, never prompt'
    });
    parser.add_argument('paths', {
        nargs: '+',
        help: 'Files or directories to remove'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    for (const pathStr of parsed.paths) {
        context.fs.remove(pathStr, parsed.recursive);
    }
    return '';
}
