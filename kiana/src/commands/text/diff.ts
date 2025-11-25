/**
 * diff - compare files line by line
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function diff(context: CommandContext, args: string[], stdin?: string | null): string {
    const parser = new ArgumentParser({
        prog: 'diff',
        description: 'Compare files line by line',
        add_help: true
    });

    parser.add_argument('-u', '--unified', {
        action: 'store_const',
        const: 3,
        dest: 'unified_context',
        help: 'Output 3 lines of unified context'
    });
    parser.add_argument('-U', {
        type: 'int',
        dest: 'unified_context',
        metavar: 'NUM',
        help: 'Output NUM lines of unified context'
    });
    parser.add_argument('-c', '--context', {
        action: 'store_const',
        const: 3,
        dest: 'context_format',
        help: 'Output 3 lines of copied context'
    });
    parser.add_argument('-C', {
        type: 'int',
        dest: 'context_format',
        metavar: 'NUM',
        help: 'Output NUM lines of copied context'
    });
    parser.add_argument('-q', '--brief', {
        action: 'store_true',
        help: 'Report only when files differ'
    });
    parser.add_argument('-i', '--ignore-case', {
        action: 'store_true',
        help: 'Ignore case differences'
    });
    parser.add_argument('-w', '--ignore-all-space', {
        action: 'store_true',
        help: 'Ignore all white space'
    });
    parser.add_argument('-b', '--ignore-space-change', {
        action: 'store_true',
        help: 'Ignore changes in the amount of white space'
    });
    parser.add_argument('-B', '--ignore-blank-lines', {
        action: 'store_true',
        help: 'Ignore changes whose lines are all blank'
    });
    parser.add_argument('file1', {
        help: 'First file to compare'
    });
    parser.add_argument('file2', {
        help: 'Second file to compare'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // Read files
    const node1 = context.fs.resolvePath(parsed.file1);
    const node2 = context.fs.resolvePath(parsed.file2);

    if (!node1) {
        throw new Error(`diff: ${parsed.file1}: No such file or directory`);
    }
    if (!node2) {
        throw new Error(`diff: ${parsed.file2}: No such file or directory`);
    }
    if (!node1.isFile()) {
        throw new Error(`diff: ${parsed.file1}: Is a directory`);
    }
    if (!node2.isFile()) {
        throw new Error(`diff: ${parsed.file2}: Is a directory`);
    }

    let lines1 = node1.read().split('\n');
    let lines2 = node2.read().split('\n');

    // Apply ignore options
    const normalizeLine = (line: string): string => {
        let normalized = line;
        if (parsed.ignore_case) {
            normalized = normalized.toLowerCase();
        }
        if (parsed.ignore_all_space) {
            normalized = normalized.replace(/\s+/g, '');
        } else if (parsed.ignore_space_change) {
            normalized = normalized.replace(/\s+/g, ' ').trim();
        }
        return normalized;
    };

    // Normalize lines for comparison
    const normalized1 = lines1.map(normalizeLine);
    const normalized2 = lines2.map(normalizeLine);

    // Filter blank lines if requested
    let compareLines1 = lines1;
    let compareLines2 = lines2;
    let compareNorm1 = normalized1;
    let compareNorm2 = normalized2;

    if (parsed.ignore_blank_lines) {
        const filterBlanks = (lines: string[], norms: string[]) => {
            const result: { lines: string[]; norms: string[]; map: number[] } = { lines: [], norms: [], map: [] };
            lines.forEach((line, i) => {
                if (line.trim() !== '') {
                    result.lines.push(line);
                    result.norms.push(norms[i]);
                    result.map.push(i);
                }
            });
            return result;
        };

        const filtered1 = filterBlanks(lines1, normalized1);
        const filtered2 = filterBlanks(lines2, normalized2);
        compareLines1 = filtered1.lines;
        compareLines2 = filtered2.lines;
        compareNorm1 = filtered1.norms;
        compareNorm2 = filtered2.norms;
    }

    // Quick check if files are identical
    if (compareNorm1.length === compareNorm2.length &&
        compareNorm1.every((line, i) => line === compareNorm2[i])) {
        return ''; // Files are identical
    }

    // Brief mode - just report if different
    if (parsed.brief) {
        return `Files ${parsed.file1} and ${parsed.file2} differ`;
    }

    // Compute diff using Myers algorithm (simplified LCS-based approach)
    const diffResult = computeDiff(compareNorm1, compareNorm2);

    // Format output based on mode
    if (parsed.unified_context !== undefined && parsed.unified_context !== null) {
        return formatUnifiedDiff(parsed.file1, parsed.file2, lines1, lines2, diffResult, parsed.unified_context);
    } else if (parsed.context_format !== undefined && parsed.context_format !== null) {
        return formatContextDiff(parsed.file1, parsed.file2, lines1, lines2, diffResult, parsed.context_format);
    } else {
        return formatNormalDiff(parsed.file1, parsed.file2, lines1, lines2, diffResult);
    }
}

/**
 * Compute diff using simple LCS-based algorithm
 */
function computeDiff(lines1: string[], lines2: string[]): any[] {
    const m = lines1.length;
    const n = lines2.length;

    // Build LCS table
    const lcs: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (lines1[i - 1] === lines2[j - 1]) {
                lcs[i][j] = lcs[i - 1][j - 1] + 1;
            } else {
                lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
            }
        }
    }

    // Backtrack to find diff
    const diffResult: any[] = [];
    let i = m, j = n;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
            diffResult.unshift({ type: 'common', line1: i - 1, line2: j - 1 });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
            diffResult.unshift({ type: 'add', line2: j - 1 });
            j--;
        } else if (i > 0) {
            diffResult.unshift({ type: 'delete', line1: i - 1 });
            i--;
        }
    }

    return diffResult;
}

/**
 * Format diff in normal format
 */
function formatNormalDiff(file1: string, file2: string, lines1: string[], lines2: string[], diffResult: any[]): string {
    const output: string[] = [];
    let i = 0;

    while (i < diffResult.length) {
        // Find continuous block of changes
        if (diffResult[i].type === 'common') {
            i++;
            continue;
        }

        let start1 = diffResult[i].line1 !== undefined ? diffResult[i].line1 : -1;
        let start2 = diffResult[i].line2 !== undefined ? diffResult[i].line2 : -1;
        let deletes: number[] = [];
        let adds: number[] = [];

        while (i < diffResult.length && diffResult[i].type !== 'common') {
            if (diffResult[i].type === 'delete') {
                deletes.push(diffResult[i].line1);
            } else if (diffResult[i].type === 'add') {
                adds.push(diffResult[i].line2);
            }
            i++;
        }

        if (deletes.length > 0 && adds.length > 0) {
            // Change
            const range1 = deletes.length === 1 ? `${deletes[0] + 1}` : `${deletes[0] + 1},${deletes[deletes.length - 1] + 1}`;
            const range2 = adds.length === 1 ? `${adds[0] + 1}` : `${adds[0] + 1},${adds[adds.length - 1] + 1}`;
            output.push(`${range1}c${range2}`);
            deletes.forEach(idx => output.push(`< ${lines1[idx]}`));
            output.push('---');
            adds.forEach(idx => output.push(`> ${lines2[idx]}`));
        } else if (deletes.length > 0) {
            // Delete
            const range1 = deletes.length === 1 ? `${deletes[0] + 1}` : `${deletes[0] + 1},${deletes[deletes.length - 1] + 1}`;
            const pos2 = adds.length > 0 ? adds[0] + 1 : (deletes[0] + 1);
            output.push(`${range1}d${pos2}`);
            deletes.forEach(idx => output.push(`< ${lines1[idx]}`));
        } else if (adds.length > 0) {
            // Add
            const pos1 = deletes.length > 0 ? deletes[0] + 1 : (adds[0]);
            const range2 = adds.length === 1 ? `${adds[0] + 1}` : `${adds[0] + 1},${adds[adds.length - 1] + 1}`;
            output.push(`${pos1}a${range2}`);
            adds.forEach(idx => output.push(`> ${lines2[idx]}`));
        }
    }

    return output.join('\n');
}

/**
 * Format diff in unified format
 */
function formatUnifiedDiff(file1: string, file2: string, lines1: string[], lines2: string[], diffResult: any[], context: number): string {
    const output: string[] = [];
    output.push(`--- ${file1}`);
    output.push(`+++ ${file2}`);

    let i = 0;
    while (i < diffResult.length) {
        // Skip common lines until we find a change
        while (i < diffResult.length && diffResult[i].type === 'common') {
            i++;
        }

        if (i >= diffResult.length) break;

        // Start of a hunk - go back for context
        const hunkStart = Math.max(0, i - context);
        let j = i;

        // Find end of changes + context
        while (j < diffResult.length && (diffResult[j].type !== 'common' ||
               (j < diffResult.length - 1 && j - i < context * 2))) {
            j++;
        }

        const hunkEnd = Math.min(diffResult.length, j + context);

        // Calculate line ranges
        let line1Start = diffResult[hunkStart].line1 !== undefined ? diffResult[hunkStart].line1 + 1 : 1;
        let line2Start = diffResult[hunkStart].line2 !== undefined ? diffResult[hunkStart].line2 + 1 : 1;
        let count1 = 0, count2 = 0;

        for (let k = hunkStart; k < hunkEnd; k++) {
            if (diffResult[k].type === 'common' || diffResult[k].type === 'delete') count1++;
            if (diffResult[k].type === 'common' || diffResult[k].type === 'add') count2++;
        }

        output.push(`@@ -${line1Start},${count1} +${line2Start},${count2} @@`);

        // Output hunk
        for (let k = hunkStart; k < hunkEnd; k++) {
            if (diffResult[k].type === 'common') {
                output.push(` ${lines1[diffResult[k].line1]}`);
            } else if (diffResult[k].type === 'delete') {
                output.push(`-${lines1[diffResult[k].line1]}`);
            } else if (diffResult[k].type === 'add') {
                output.push(`+${lines2[diffResult[k].line2]}`);
            }
        }

        i = hunkEnd;
    }

    return output.join('\n');
}

/**
 * Format diff in context format
 */
function formatContextDiff(file1: string, file2: string, lines1: string[], lines2: string[], diffResult: any[], context: number): string {
    const output: string[] = [];
    output.push(`*** ${file1}`);
    output.push(`--- ${file2}`);

    let i = 0;
    while (i < diffResult.length) {
        // Skip common lines
        while (i < diffResult.length && diffResult[i].type === 'common') {
            i++;
        }

        if (i >= diffResult.length) break;

        const hunkStart = Math.max(0, i - context);
        let j = i;

        while (j < diffResult.length && (diffResult[j].type !== 'common' || j - i < context * 2)) {
            j++;
        }

        const hunkEnd = Math.min(diffResult.length, j + context);

        // Output context hunk header
        let line1Start = diffResult[hunkStart].line1 !== undefined ? diffResult[hunkStart].line1 + 1 : 1;
        let line1End = line1Start;
        let line2Start = diffResult[hunkStart].line2 !== undefined ? diffResult[hunkStart].line2 + 1 : 1;
        let line2End = line2Start;

        for (let k = hunkStart; k < hunkEnd; k++) {
            if (diffResult[k].line1 !== undefined) line1End = diffResult[k].line1 + 1;
            if (diffResult[k].line2 !== undefined) line2End = diffResult[k].line2 + 1;
        }

        output.push(`***************`);
        output.push(`*** ${line1Start},${line1End} ****`);

        // Output old file context
        for (let k = hunkStart; k < hunkEnd; k++) {
            if (diffResult[k].type === 'common') {
                output.push(`  ${lines1[diffResult[k].line1]}`);
            } else if (diffResult[k].type === 'delete') {
                output.push(`- ${lines1[diffResult[k].line1]}`);
            }
        }

        output.push(`--- ${line2Start},${line2End} ----`);

        // Output new file context
        for (let k = hunkStart; k < hunkEnd; k++) {
            if (diffResult[k].type === 'common') {
                output.push(`  ${lines2[diffResult[k].line2]}`);
            } else if (diffResult[k].type === 'add') {
                output.push(`+ ${lines2[diffResult[k].line2]}`);
            }
        }

        i = hunkEnd;
    }

    return output.join('\n');
}
