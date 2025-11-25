"use strict";
/**
 * basename - strip directory and suffix from filenames
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.basename = basename;
const argparse_1 = require("argparse");
function basename(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'basename',
        description: 'Strip directory and suffix from filenames',
        add_help: true
    });
    parser.add_argument('name', {
        help: 'The filename or path'
    });
    parser.add_argument('suffix', {
        nargs: '?',
        help: 'Optional suffix to remove'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const name = parsed.name;
    const suffix = parsed.suffix;
    // Extract basename from path
    let base = name;
    // Handle different path separators
    const lastSlash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
    if (lastSlash >= 0) {
        base = name.substring(lastSlash + 1);
    }
    // Remove suffix if provided
    if (suffix && base.endsWith(suffix)) {
        base = base.substring(0, base.length - suffix.length);
    }
    return base;
}
