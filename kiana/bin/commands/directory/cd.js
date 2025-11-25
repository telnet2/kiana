"use strict";
/**
 * cd - change directory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cd = cd;
const argparse_1 = require("argparse");
function cd(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'cd',
        description: 'Change directory',
        add_help: true
    });
    parser.add_argument('path', {
        nargs: '?',
        default: '/',
        help: 'Directory to change to'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    context.fs.changeDirectory(parsed.path);
    return '';
}
