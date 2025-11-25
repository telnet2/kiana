/**
 * sort - sort lines of text files
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function sort(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'sort',
        description: 'Sort lines of text files',
        add_help: true
    });

    parser.add_argument('-r', '--reverse', {
        action: 'store_true',
        help: 'Reverse the result of comparisons'
    });

    parser.add_argument('-n', '--numeric-sort', {
        action: 'store_true',
        help: 'Compare according to string numerical value'
    });

    parser.add_argument('-u', '--unique', {
        action: 'store_true',
        help: 'With -c, check for strict ordering; without -c, output only the first of an equal run'
    });

    parser.add_argument('-i', '--ignore-case', {
        action: 'store_true',
        help: 'Ignore differences in case when comparing'
    });

    parser.add_argument('files', {
        nargs: '*',
        help: 'File(s) to read'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const reverse = parsed.reverse;
    const numericSort = parsed.numeric_sort;
    const unique = parsed.unique;
    const ignoreCase = parsed.ignore_case;
    const files = parsed.files || [];

    // Collect all lines
    let allLines: string[] = [];

    // If no files specified, read from stdin
    if (files.length === 0) {
        if (stdin === null) {
            throw new Error('sort: no input');
        }
        allLines = stdin.split('\n');
    } else {
        // Read from files
        for (const file of files) {
            const node = context.fs.resolvePath(file);
            if (!node) {
                throw new Error(`sort: cannot open ${file} for reading: No such file or directory`);
            }

            if (!node.isFile()) {
                throw new Error(`sort: ${file}: Is a directory`);
            }

            const content = node.read();
            allLines = allLines.concat(content.split('\n'));
        }
    }

    // Sort lines
    allLines.sort((a, b) => {
        let aVal = a;
        let bVal = b;

        if (ignoreCase) {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        let comparison = 0;

        if (numericSort) {
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            const aIsNum = !isNaN(aNum);
            const bIsNum = !isNaN(bNum);

            if (aIsNum && bIsNum) {
                comparison = aNum - bNum;
            } else if (aIsNum) {
                comparison = -1;
            } else if (bIsNum) {
                comparison = 1;
            } else {
                comparison = aVal.localeCompare(bVal);
            }
        } else {
            comparison = aVal.localeCompare(bVal);
        }

        return reverse ? -comparison : comparison;
    });

    // Remove duplicates if requested
    if (unique) {
        const seen = new Set<string>();
        allLines = allLines.filter(line => {
            if (seen.has(line)) {
                return false;
            }
            seen.add(line);
            return true;
        });
    }

    return allLines.join('\n');
}
