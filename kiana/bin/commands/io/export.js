"use strict";
/**
 * export - export file or directory to real filesystem
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCommand = exportCommand;
const argparse_1 = require("argparse");
function exportCommand(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'export',
        description: 'Export file or directory to real filesystem',
        add_help: true
    });
    parser.add_argument('source', {
        help: 'Memory filesystem path to export'
    });
    parser.add_argument('destination', {
        help: 'Real filesystem destination path'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    try {
        const node = context.fs.resolvePath(parsed.source);
        if (!node) {
            throw new Error(`No such file or directory: ${parsed.source}`);
        }
        if (node.isDirectory()) {
            context.fs.exportDirectory(parsed.source, parsed.destination);
        }
        else {
            context.fs.exportFile(parsed.source, parsed.destination);
        }
        return `Exported: ${parsed.source} -> ${parsed.destination}`;
    }
    catch (err) {
        throw new Error(`export: ${err.message}`);
    }
}
