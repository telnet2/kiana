"use strict";
/**
 * find - Search for files in directory hierarchy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.find = find;
const argparse_1 = require("argparse");
function find(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'find',
        description: 'Search for files in directory hierarchy',
        add_help: true
    });
    parser.add_argument('path', {
        nargs: '?',
        default: '.',
        help: 'Starting directory'
    });
    parser.add_argument('-name', {
        help: 'Base of file name (can use wildcards)'
    });
    parser.add_argument('-type', {
        choices: ['f', 'd', 'l'],
        help: 'File type: f (file), d (directory), l (link)'
    });
    parser.add_argument('-maxdepth', {
        type: 'int',
        help: 'Maximum directory depth'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const node = context.fs.resolvePath(parsed.path);
    if (!node) {
        throw new Error(`find: '${parsed.path}': No such file or directory`);
    }
    const results = [];
    const namePattern = parsed.name ? new RegExp(parsed.name.replace(/\*/g, '.*').replace(/\?/g, '.')) : null;
    const typeFilter = parsed.type;
    const maxDepth = parsed.maxdepth;
    const traverse = (current, basePath, depth = 0) => {
        const currentPath = basePath || current.getPath();
        // Apply filters
        let shouldInclude = true;
        if (namePattern && !namePattern.test(current.name)) {
            shouldInclude = false;
        }
        if (typeFilter === 'f' && !current.isFile()) {
            shouldInclude = false;
        }
        if (typeFilter === 'd' && !current.isDirectory()) {
            shouldInclude = false;
        }
        if (shouldInclude) {
            results.push(currentPath);
        }
        // Check depth limit
        if (maxDepth !== null && maxDepth !== undefined && depth >= maxDepth) {
            return;
        }
        if (current.isDirectory()) {
            for (const child of current.listChildren()) {
                const childPath = currentPath === '/' ? `/${child.name}` : `${currentPath}/${child.name}`;
                traverse(child, childPath, depth + 1);
            }
        }
    };
    traverse(node, null);
    return results.join('\n');
}
