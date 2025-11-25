"use strict";
/**
 * mkdir - make directories
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mkdir = mkdir;
const argparse_1 = require("argparse");
function mkdir(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'mkdir',
        description: 'Create directories',
        add_help: true
    });
    parser.add_argument('-p', '--parents', {
        action: 'store_true',
        help: 'Create parent directories as needed'
    });
    parser.add_argument('directories', {
        nargs: '+',
        help: 'Directories to create'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    for (const pathStr of parsed.directories) {
        if (parsed.parents) {
            context.fs.createDirectories(pathStr);
        }
        else {
            context.fs.createDirectory(pathStr);
        }
    }
    return '';
}
