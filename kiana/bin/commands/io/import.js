"use strict";
/**
 * import - import file or directory from real filesystem
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCommand = importCommand;
const argparse_1 = require("argparse");
const path = require("path");
const fs = require("fs");
const micromatch = require("micromatch");
function importCommand(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'import',
        description: 'Import file or directory from real filesystem (supports wildcards like *.md)',
        add_help: true
    });
    parser.add_argument('-r', {
        dest: 'recursive',
        action: 'store_true',
        help: 'Import directories recursively'
    });
    parser.add_argument('-R', '--recursive', {
        action: 'store_true',
        help: 'Import directories recursively'
    });
    parser.add_argument('source', {
        help: 'Real filesystem path to import (supports wildcards like *.md, *.txt)'
    });
    parser.add_argument('destination', {
        nargs: '?',
        help: 'Memory filesystem destination path'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    try {
        const sourcePath = parsed.source;
        const destPath = parsed.destination;
        // Check if source contains wildcard patterns
        const hasWildcards = sourcePath.includes('*') || sourcePath.includes('?') || sourcePath.includes('[');
        if (hasWildcards) {
            // Handle wildcard import
            return handleWildcardImport(sourcePath, destPath, context, parsed.recursive);
        }
        else {
            // Handle single file/directory import (existing logic)
            return handleSingleImport(sourcePath, destPath, context, parsed.recursive);
        }
    }
    catch (err) {
        throw new Error(`import: ${err.message}`);
    }
}
function handleSingleImport(sourcePath, destPath, context, recursive) {
    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory()) {
        if (!recursive) {
            throw new Error('import: omitting directory (use -r or -R for recursive)');
        }
        context.fs.importDirectory(sourcePath, destPath);
    }
    else {
        context.fs.importFile(sourcePath, destPath);
    }
    return `Imported: ${sourcePath}`;
}
function handleWildcardImport(pattern, destPath, context, recursive) {
    // Extract directory and pattern parts
    const parsedPath = path.parse(pattern);
    const dirPath = parsedPath.dir || '.';
    const filePattern = parsedPath.base;
    // Validate directory exists
    if (!fs.existsSync(dirPath)) {
        throw new Error(`No such directory: ${dirPath}`);
    }
    const dirStats = fs.statSync(dirPath);
    if (!dirStats.isDirectory()) {
        throw new Error(`Not a directory: ${dirPath}`);
    }
    // Get all files and directories in the specified directory
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const matches = [];
    for (const entry of entries) {
        const entryName = entry.name;
        const fullPath = path.join(dirPath, entryName);
        // Check if entry name matches the pattern
        if (micromatch.isMatch(entryName, filePattern)) {
            matches.push(fullPath);
        }
    }
    if (matches.length === 0) {
        throw new Error(`No files match pattern: ${pattern}`);
    }
    // Create destination directory if specified and doesn't exist
    if (destPath) {
        try {
            const destNode = context.fs.resolvePath(destPath);
            if (!destNode) {
                // Create the destination directory
                context.fs.createDirectory(destPath);
            }
            else if (!destNode.isDirectory()) {
                throw new Error(`Destination exists but is not a directory: ${destPath}`);
            }
        }
        catch (err) {
            // If resolvePath throws, it means the path doesn't exist, so create it
            context.fs.createDirectory(destPath);
        }
    }
    // Import matched files
    const importedFiles = [];
    const importedDirs = [];
    for (const match of matches) {
        const stats = fs.statSync(match);
        const fileName = path.basename(match);
        if (stats.isDirectory()) {
            if (recursive) {
                const targetName = destPath ? path.join(destPath, fileName) : fileName;
                context.fs.importDirectory(match, targetName);
                importedDirs.push(match);
            }
            else {
                // Skip directories if not recursive
                continue;
            }
        }
        else {
            const targetName = destPath ? path.join(destPath, fileName) : fileName;
            context.fs.importFile(match, targetName);
            importedFiles.push(match);
        }
    }
    if (importedFiles.length === 0 && importedDirs.length === 0) {
        throw new Error(`No files or directories imported for pattern: ${pattern}`);
    }
    // Return summary
    const results = [];
    if (importedFiles.length > 0) {
        results.push(`Imported ${importedFiles.length} file(s): ${importedFiles.join(', ')}`);
    }
    if (importedDirs.length > 0) {
        results.push(`Imported ${importedDirs.length} directory(ies): ${importedDirs.join(', ')}`);
    }
    return results.join('\n');
}
