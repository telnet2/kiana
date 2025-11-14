"use strict";
/**
 * ls - list directory contents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ls = ls;
const argparse_1 = require("argparse");
function ls(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'ls',
        description: 'List directory contents',
        add_help: true
    });
    parser.add_argument('-l', {
        action: 'store_true',
        help: 'Use long listing format'
    });
    parser.add_argument('-a', '--all', {
        action: 'store_true',
        help: 'Show hidden files (. and ..)'
    });
    parser.add_argument('paths', {
        nargs: '*',
        default: ['.'],
        help: 'Directories or files to list'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const paths = parsed.paths.length > 0 ? parsed.paths : ['.'];
    const results = [];
    // Debug logging
    console.log(`[ls] Listing paths:`, paths);
    const rootNode = context.fs.resolvePath('/');
    console.log(`[ls] Root directory exists:`, !!rootNode);
    if (rootNode && rootNode.isDirectory?.()) {
        const rootChildren = typeof rootNode.listChildren === 'function'
            ? rootNode.listChildren()
            : Array.from(rootNode.children.values());
        console.log(`[ls] Root has ${rootChildren.length} children:`, rootChildren.map(c => c.name));
    }
    // Check if we have multiple directories (not just multiple files)
    const dirCount = paths.filter((p) => {
        const n = context.fs.resolvePath(p);
        return n && n.isDirectory();
    }).length;
    for (let i = 0; i < paths.length; i++) {
        const pathStr = paths[i];
        const node = context.fs.resolvePath(pathStr);
        if (!node) {
            throw new Error(`ls: cannot access '${pathStr}': No such file or directory`);
        }
        // Show filename header if multiple directories
        if (dirCount > 1 && node.isDirectory()) {
            results.push(`${pathStr}:`);
        }
        if (node.isFile()) {
            results.push(parsed.l ? formatLong([node]) : node.name);
        }
        else if (node.isDirectory()) {
            // Use listChildren() method if available, otherwise fallback to children.values()
            const children = typeof node.listChildren === 'function'
                ? node.listChildren()
                : Array.from(node.children.values());
            if (parsed.l) {
                results.push(formatLong(children));
            }
            else if (parsed.all) {
                results.push(['.', '..', ...children.map((c) => c.name)].join('\n'));
            }
            else {
                results.push(children.map((c) => c.name).join('\n'));
            }
            // Add blank line after directory listing if there are more items
            if (dirCount > 1 && i < paths.length - 1) {
                results.push('');
            }
        }
    }
    return results.join('\n').trim();
}
function formatLong(nodes) {
    const lines = nodes.map(node => {
        const type = node.isDirectory() ? 'd' : '-';
        const size = node.isFile() ? node.size().toString().padStart(8) : '0'.padStart(8);
        const date = node.modifiedAt.toISOString().slice(0, 16).replace('T', ' ');
        return `${type}rwxr-xr-x  ${size}  ${date}  ${node.name}`;
    });
    return lines.join('\n');
}
