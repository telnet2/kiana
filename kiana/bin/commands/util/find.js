"use strict";
/**
 * find - Search for files in directory hierarchy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.find = find;
function find(context, args) {
    // Manually parse arguments to support -o (OR) operator
    let path = '.';
    let typeFilter = null;
    let maxDepth = null;
    let namePatterns = [];
    let i = 0;
    // First, check if first arg is a path (doesn't start with -)
    if (args.length > 0 && !args[0].startsWith('-')) {
        path = args[0];
        i = 1;
    }
    // Parse remaining arguments
    while (i < args.length) {
        const arg = args[i];
        if (arg === '-name' && i + 1 < args.length) {
            const pattern = args[i + 1];
            namePatterns.push(new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.')));
            i += 2;
        }
        else if (arg === '-type' && i + 1 < args.length) {
            typeFilter = args[i + 1];
            i += 2;
        }
        else if (arg === '-maxdepth' && i + 1 < args.length) {
            maxDepth = parseInt(args[i + 1], 10);
            i += 2;
        }
        else if (arg === '-o') {
            // -o is just a separator, skip it
            i += 1;
        }
        else if (arg === '--help' || arg === '-h') {
            return 'Usage: find [path] [-name pattern] [-o -name pattern ...] [-type f|d|l] [-maxdepth depth]\n' +
                'Search for files in directory hierarchy\n\n' +
                'Options:\n' +
                '  -name PATTERN    Base of file name (can use wildcards * and ?)\n' +
                '  -type TYPE       File type: f (file), d (directory), l (link)\n' +
                '  -maxdepth NUM    Maximum directory depth\n' +
                '  -o               OR operator (for combining multiple conditions)';
        }
        else {
            i += 1;
        }
    }
    const node = context.fs.resolvePath(path);
    if (!node) {
        throw new Error(`find: '${path}': No such file or directory`);
    }
    const results = [];
    const traverse = (current, basePath, depth = 0) => {
        const currentPath = basePath || current.getPath();
        // Apply filters
        let shouldInclude = true;
        // If name patterns are specified, match at least one (OR logic)
        if (namePatterns.length > 0) {
            shouldInclude = namePatterns.some(pattern => pattern.test(current.name));
        }
        // If type filter specified, must match
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
