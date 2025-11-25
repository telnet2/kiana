/**
 * tr - translate or delete characters
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function tr(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'tr',
        description: 'Translate or delete characters',
        add_help: true
    });

    parser.add_argument('-d', '--delete', {
        action: 'store_true',
        help: 'Delete characters in SET1'
    });

    parser.add_argument('-s', '--squeeze-repeats', {
        action: 'store_true',
        help: 'Squeeze repeated characters'
    });

    parser.add_argument('set1', {
        help: 'Source character set'
    });

    parser.add_argument('set2', {
        nargs: '?',
        help: 'Destination character set (required unless -d is used)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // tr requires stdin
    if (stdin === null || stdin === undefined) {
        throw new Error('tr: no input provided');
    }

    const set1 = parsed.set1;
    const set2 = parsed.set2;
    const deleteMode = parsed.delete;
    const squeezeMode = parsed.squeeze_repeats;

    // Validate arguments
    if (!deleteMode && !set2) {
        throw new Error('tr: missing operand');
    }

    // Expand character ranges (e.g., 'a-z', '0-9')
    const expandSet = (set: string): string[] => {
        const chars: string[] = [];
        let i = 0;

        while (i < set.length) {
            if (i + 2 < set.length && set[i + 1] === '-') {
                // Range detected
                const start = set.charCodeAt(i);
                const end = set.charCodeAt(i + 2);

                for (let code = start; code <= end; code++) {
                    chars.push(String.fromCharCode(code));
                }

                i += 3;
            } else if (set[i] === '\\' && i + 1 < set.length) {
                // Escape sequence
                const nextChar = set[i + 1];
                if (nextChar === 'n') chars.push('\n');
                else if (nextChar === 't') chars.push('\t');
                else if (nextChar === 'r') chars.push('\r');
                else if (nextChar === '\\') chars.push('\\');
                else chars.push(nextChar);

                i += 2;
            } else {
                chars.push(set[i]);
                i += 1;
            }
        }

        return chars;
    };

    const expandedSet1 = expandSet(set1);
    const expandedSet2 = set2 ? expandSet(set2) : [];

    let result = '';

    if (deleteMode) {
        // Delete mode: remove all characters in set1
        const deleteSet = new Set(expandedSet1);
        for (const char of stdin) {
            if (!deleteSet.has(char)) {
                result += char;
            }
        }
    } else {
        // Translate mode: replace characters from set1 with set2
        const translationMap = new Map<string, string>();

        for (let i = 0; i < expandedSet1.length; i++) {
            const source = expandedSet1[i];
            // If set2 is shorter, repeat the last character
            const targetIndex = Math.min(i, expandedSet2.length - 1);
            const target = expandedSet2[targetIndex];
            translationMap.set(source, target);
        }

        for (const char of stdin) {
            if (translationMap.has(char)) {
                result += translationMap.get(char);
            } else {
                result += char;
            }
        }
    }

    // Squeeze repeated characters if requested
    if (squeezeMode) {
        let squeezed = '';
        let lastChar = '';

        for (const char of result) {
            if (char !== lastChar) {
                squeezed += char;
                lastChar = char;
            }
        }

        return squeezed;
    }

    return result;
}
