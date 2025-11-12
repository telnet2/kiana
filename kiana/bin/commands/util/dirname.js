"use strict";
/**
 * dirname - strip last component from file path(s)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dirname = dirname;
const argparse_1 = require("argparse");
function dirname(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'dirname',
        description: 'Strip last component from file path(s)',
        add_help: true
    });
    parser.add_argument('paths', {
        nargs: '+',
        help: 'File path(s)'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const paths = parsed.paths;
    if (!paths || paths.length === 0) {
        throw new Error('dirname: missing operand');
    }
    const results = [];
    for (const path of paths) {
        // Handle edge cases
        if (path === '/' || path === '') {
            results.push('.');
            continue;
        }
        // Remove trailing slashes
        let normalized = path.replace(/\/+$/, '');
        // Handle paths with no directory component
        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash === -1) {
            results.push('.');
            continue;
        }
        // Extract directory
        if (lastSlash === 0) {
            results.push('/');
        }
        else {
            results.push(normalized.substring(0, lastSlash));
        }
    }
    return results.join('\n');
}
