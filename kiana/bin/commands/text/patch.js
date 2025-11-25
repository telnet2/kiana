"use strict";
/**
 * patch - apply a diff file to an original
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.patch = patch;
const argparse_1 = require("argparse");
function patch(context, args, stdin = null) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'patch',
        description: 'Apply a diff file to an original',
        add_help: true
    });
    parser.add_argument('-p', '--strip', {
        type: 'int',
        default: 0,
        metavar: 'NUM',
        dest: 'strip',
        help: 'Strip NUM leading path components from filenames'
    });
    parser.add_argument('-R', '--reverse', {
        action: 'store_true',
        help: 'Apply patch in reverse'
    });
    parser.add_argument('-o', '--output', {
        metavar: 'FILE',
        help: 'Output to FILE instead of patching in-place'
    });
    parser.add_argument('-i', '--input', {
        metavar: 'PATCHFILE',
        help: 'Read patch from PATCHFILE instead of stdin'
    });
    parser.add_argument('file', {
        nargs: '?',
        help: 'File to patch (can be determined from patch)'
    });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    // Get patch content
    let patchContent;
    if (parsed.input) {
        const patchNode = context.fs.resolvePath(parsed.input);
        if (!patchNode) {
            throw new Error(`patch: ${parsed.input}: No such file or directory`);
        }
        if (!patchNode.isFile()) {
            throw new Error(`patch: ${parsed.input}: Is a directory`);
        }
        patchContent = patchNode.read();
    }
    else if (stdin !== null && stdin !== undefined) {
        patchContent = stdin;
    }
    else {
        throw new Error('patch: missing patch input (use -i or stdin)');
    }
    // Parse the patch
    const patchInfo = parsePatch(patchContent);
    // Determine target file
    let targetFile = parsed.file;
    if (!targetFile && patchInfo.targetFile) {
        // Extract from patch headers with path stripping
        targetFile = stripPathComponents(patchInfo.targetFile, parsed.strip);
    }
    if (!targetFile) {
        throw new Error('patch: cannot determine file to patch');
    }
    // Read original file
    const targetNode = context.fs.resolvePath(targetFile);
    if (!targetNode) {
        throw new Error(`patch: ${targetFile}: No such file or directory`);
    }
    if (!targetNode.isFile()) {
        throw new Error(`patch: ${targetFile}: Is a directory`);
    }
    const originalContent = targetNode.read();
    const originalLines = originalContent.split('\n');
    // Apply patch
    const patchedLines = applyPatch(originalLines, patchInfo.hunks, parsed.reverse);
    const patchedContent = patchedLines.join('\n');
    // Write result
    if (parsed.output) {
        const outputNode = context.fs.resolvePath(parsed.output);
        if (outputNode && outputNode.isFile()) {
            outputNode.write(patchedContent);
        }
        else {
            // Create new file
            context.fs.createFile(parsed.output, patchedContent);
        }
        return `patched to ${parsed.output}`;
    }
    else {
        targetNode.write(patchedContent);
        return `patched ${targetFile}`;
    }
}
/**
 * Parse patch file and extract hunks
 * Supports unified, context, and normal diff formats
 */
function parsePatch(patchContent) {
    const lines = patchContent.split('\n');
    const hunks = [];
    let targetFile = null;
    let sourceFile = null;
    let i = 0;
    // Detect format and parse
    while (i < lines.length) {
        const line = lines[i];
        // Parse unified diff format (--- and +++)
        if (line.startsWith('---')) {
            sourceFile = extractFilename(line);
            i++;
            if (i < lines.length && lines[i].startsWith('+++')) {
                targetFile = extractFilename(lines[i]);
                i++;
            }
            continue;
        }
        // Parse unified diff hunk (@@ -start,count +start,count @@)
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
            if (match) {
                const oldStart = parseInt(match[1]) - 1; // Convert to 0-based
                const oldCount = match[2] ? parseInt(match[2]) : 1;
                const newStart = parseInt(match[3]) - 1;
                const newCount = match[4] ? parseInt(match[4]) : 1;
                const hunk = {
                    type: 'unified',
                    oldStart,
                    oldCount,
                    newStart,
                    newCount,
                    lines: []
                };
                i++;
                // Read hunk content
                while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('---')) {
                    const hunkLine = lines[i];
                    if (hunkLine.startsWith(' ') || hunkLine.startsWith('+') || hunkLine.startsWith('-')) {
                        hunk.lines.push({
                            type: hunkLine[0] === '+' ? 'add' : hunkLine[0] === '-' ? 'delete' : 'context',
                            content: hunkLine.substring(1)
                        });
                    }
                    else if (hunkLine === '') {
                        hunk.lines.push({ type: 'context', content: '' });
                    }
                    i++;
                }
                hunks.push(hunk);
                continue;
            }
        }
        // Parse normal diff format (1,2c3,4 or 1d2 or 1a2,3)
        const normalMatch = line.match(/^(\d+)(?:,(\d+))?([adc])(\d+)(?:,(\d+))?$/);
        if (normalMatch) {
            const oldStart = parseInt(normalMatch[1]) - 1;
            const oldEnd = normalMatch[2] ? parseInt(normalMatch[2]) - 1 : oldStart;
            const operation = normalMatch[3];
            const newStart = parseInt(normalMatch[4]) - 1;
            const newEnd = normalMatch[5] ? parseInt(normalMatch[5]) - 1 : newStart;
            const hunk = {
                type: 'normal',
                operation,
                oldStart,
                oldEnd,
                newStart,
                newEnd,
                oldLines: [],
                newLines: []
            };
            i++;
            // Read old lines (< prefix)
            if (operation === 'c' || operation === 'd') {
                while (i < lines.length && lines[i].startsWith('<')) {
                    hunk.oldLines.push(lines[i].substring(2));
                    i++;
                }
            }
            // Skip separator (---)
            if (i < lines.length && lines[i] === '---') {
                i++;
            }
            // Read new lines (> prefix)
            if (operation === 'c' || operation === 'a') {
                while (i < lines.length && lines[i].startsWith('>')) {
                    hunk.newLines.push(lines[i].substring(2));
                    i++;
                }
            }
            hunks.push(hunk);
            continue;
        }
        i++;
    }
    return { targetFile, sourceFile, hunks };
}
/**
 * Extract filename from diff header line
 */
function extractFilename(line) {
    // Remove prefix (---, +++, etc.)
    let filename = line.replace(/^[-+]{3}\s+/, '');
    // Remove timestamp if present
    filename = filename.replace(/\t.*$/, '');
    // Remove quotes if present
    filename = filename.replace(/^["']|["']$/g, '');
    return filename;
}
/**
 * Strip leading path components from filename
 */
function stripPathComponents(filename, count) {
    if (count === 0)
        return filename;
    const parts = filename.split('/');
    if (count >= parts.length) {
        return parts[parts.length - 1];
    }
    return parts.slice(count).join('/');
}
/**
 * Apply parsed hunks to original lines
 */
function applyPatch(originalLines, hunks, reverse = false) {
    let result = [...originalLines];
    // Apply hunks in reverse order to maintain line indices
    const sortedHunks = [...hunks].sort((a, b) => {
        const aStart = a.type === 'unified' ? a.oldStart : a.oldStart;
        const bStart = b.type === 'unified' ? b.oldStart : b.oldStart;
        return bStart - aStart;
    });
    for (const hunk of sortedHunks) {
        if (hunk.type === 'unified') {
            result = applyUnifiedHunk(result, hunk, reverse);
        }
        else if (hunk.type === 'normal') {
            result = applyNormalHunk(result, hunk, reverse);
        }
    }
    return result;
}
/**
 * Apply unified diff hunk
 */
function applyUnifiedHunk(lines, hunk, reverse) {
    const result = [...lines];
    const { oldStart, oldCount, newStart, newCount } = hunk;
    if (reverse) {
        // Reverse: apply the patch backwards (undo changes)
        // Start from newStart (where the new file would be)
        let currentLine = newStart;
        let resultIndex = newStart;
        for (const line of hunk.lines) {
            if (line.type === 'add') {
                // In reverse, 'add' becomes 'delete' - remove this line
                result.splice(resultIndex, 1);
                // Don't increment resultIndex since we removed a line
            }
            else if (line.type === 'delete') {
                // In reverse, 'delete' becomes 'add' - insert this line
                result.splice(resultIndex, 0, line.content);
                resultIndex++;
            }
            else {
                // context line - just move forward
                resultIndex++;
            }
        }
    }
    else {
        // Forward: normal application
        // Start from oldStart (current file position)
        let resultIndex = oldStart;
        for (const line of hunk.lines) {
            if (line.type === 'delete') {
                // Remove line from original
                result.splice(resultIndex, 1);
                // Don't increment resultIndex since we removed a line
            }
            else if (line.type === 'add') {
                // Insert new line
                result.splice(resultIndex, 0, line.content);
                resultIndex++;
            }
            else {
                // context line - just move forward
                resultIndex++;
            }
        }
    }
    return result;
}
/**
 * Apply normal diff hunk
 */
function applyNormalHunk(lines, hunk, reverse) {
    const result = [...lines];
    const { operation, oldStart, oldEnd, newStart, newEnd, oldLines, newLines } = hunk;
    if (reverse) {
        // Reverse the operation
        if (operation === 'a') {
            // Add becomes delete
            result.splice(newStart, newEnd - newStart + 1);
        }
        else if (operation === 'd') {
            // Delete becomes add
            result.splice(oldStart, 0, ...newLines);
        }
        else if (operation === 'c') {
            // Change is reversed
            result.splice(newStart, newEnd - newStart + 1, ...oldLines);
        }
    }
    else {
        // Forward application
        if (operation === 'a') {
            // Add lines
            result.splice(oldStart + 1, 0, ...newLines);
        }
        else if (operation === 'd') {
            // Delete lines
            result.splice(oldStart, oldEnd - oldStart + 1);
        }
        else if (operation === 'c') {
            // Change lines
            result.splice(oldStart, oldEnd - oldStart + 1, ...newLines);
        }
    }
    return result;
}
