"use strict";
/**
 * export - export file or directory to real filesystem
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCommand = exportCommand;
const path = require("path");
const fs = require("fs");
const micromatch = require("micromatch");
function exportCommand(context, args) {
    // Handle variable number of arguments for wildcard support
    if (args.length < 2) {
        throw new Error('export: missing destination operand');
    }
    // Last argument is always the destination
    const destPath = args[args.length - 1];
    // All other arguments are source patterns (could be multiple due to wildcard expansion)
    const sourcePatterns = args.slice(0, -1);
    // If we have multiple source patterns (from wildcard expansion), handle as wildcard export
    if (sourcePatterns.length > 1) {
        return handleMultipleExports(sourcePatterns, destPath, context);
    }
    // Single source pattern - check if it contains wildcards
    const sourcePath = sourcePatterns[0];
    const hasWildcards = sourcePath.includes('*') || sourcePath.includes('?') || sourcePath.includes('[');
    if (hasWildcards) {
        return handleWildcardExport(sourcePath, destPath, context);
    }
    else {
        return handleSingleExport(sourcePath, destPath, context);
    }
}
function handleMultipleExports(sourcePatterns, destPath, context) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
    }
    const exportedFiles = [];
    for (const sourcePattern of sourcePatterns) {
        try {
            // Check if this individual pattern has wildcards
            const hasWildcards = sourcePattern.includes('*') || sourcePattern.includes('?') || sourcePattern.includes('[');
            if (hasWildcards) {
                // Handle wildcard pattern
                const wildcardResults = handleWildcardExportInternal(sourcePattern, destPath, context, false);
                exportedFiles.push(...wildcardResults);
            }
            else {
                // Handle single file
                const node = context.fs.resolvePath(sourcePattern);
                if (node && node.isFile()) {
                    const fileName = path.basename(sourcePattern);
                    const targetPath = path.join(destPath, fileName);
                    context.fs.exportFile(sourcePattern, targetPath);
                    exportedFiles.push(sourcePattern);
                }
            }
        }
        catch (err) {
            // Continue with other files even if one fails
            console.warn(`Warning: Could not export ${sourcePattern}: ${err.message}`);
        }
    }
    if (exportedFiles.length === 0) {
        throw new Error('No files exported');
    }
    return `Exported ${exportedFiles.length} file(s): ${exportedFiles.join(', ')} -> ${destPath}`;
}
function handleWildcardExportInternal(pattern, destPath, context, returnSummary = true) {
    const exportedFiles = [];
    // Extract directory and pattern parts
    const parsedPath = path.parse(pattern);
    const dirPath = parsedPath.dir || '.';
    const filePattern = parsedPath.base;
    // Resolve the directory path in MemFS
    const dirNode = context.fs.resolvePath(dirPath);
    if (!dirNode) {
        if (returnSummary)
            throw new Error(`No such directory: ${dirPath}`);
        return exportedFiles;
    }
    if (!dirNode.isDirectory()) {
        if (returnSummary)
            throw new Error(`Not a directory: ${dirPath}`);
        return exportedFiles;
    }
    // Get all files from the directory
    const allFiles = context.getAllFilesRecursive(dirNode.getPath());
    // Filter files that match the pattern (exclude directories)
    for (const filePath of allFiles) {
        const fileName = path.basename(filePath);
        // Check if file name matches the pattern and it's a file (not directory)
        if (micromatch.isMatch(fileName, filePattern)) {
            const fullPath = dirPath === '.' ? fileName : path.join(dirPath, filePath);
            const node = context.fs.resolvePath(fullPath);
            if (node && node.isFile()) {
                exportedFiles.push(fullPath);
            }
        }
    }
    return exportedFiles;
}
function handleSingleExport(sourcePath, destPath, context) {
    const node = context.fs.resolvePath(sourcePath);
    if (!node) {
        throw new Error(`No such file or directory: ${sourcePath}`);
    }
    if (node.isDirectory()) {
        context.fs.exportDirectory(sourcePath, destPath);
    }
    else {
        context.fs.exportFile(sourcePath, destPath);
    }
    return `Exported: ${sourcePath} -> ${destPath}`;
}
function handleWildcardExport(pattern, destPath, context) {
    // Get matching files
    const matchingFiles = handleWildcardExportInternal(pattern, destPath, context, false);
    if (matchingFiles.length === 0) {
        throw new Error(`No files match pattern: ${pattern}`);
    }
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
    }
    // Export matched files
    const exportedFiles = [];
    for (const filePath of matchingFiles) {
        const fileName = path.basename(filePath);
        const targetPath = path.join(destPath, fileName);
        try {
            context.fs.exportFile(filePath, targetPath);
            exportedFiles.push(filePath);
        }
        catch (err) {
            // Skip files that can't be exported, but continue with others
            console.warn(`Warning: Could not export ${filePath}: ${err.message}`);
        }
    }
    if (exportedFiles.length === 0) {
        throw new Error(`No files exported for pattern: ${pattern}`);
    }
    // Return summary
    return `Exported ${exportedFiles.length} file(s): ${exportedFiles.join(', ')} -> ${destPath}`;
}
