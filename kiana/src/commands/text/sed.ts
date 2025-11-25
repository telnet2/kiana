/**
 * sed - stream editor for filtering and transforming text
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function sed(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'sed',
        description: 'Stream editor for filtering and transforming text',
        add_help: true
    });

    parser.add_argument('-e', '--expression', {
        action: 'append',
        dest: 'scripts',
        help: 'Add the script to the commands to be executed'
    });
    parser.add_argument('-i', '--in-place', {
        action: 'store_true',
        help: 'Edit files in place'
    });
    parser.add_argument('-n', '--quiet', {
        dest: 'quiet',
        action: 'store_true',
        help: 'Suppress automatic printing of pattern space'
    });
    parser.add_argument('--silent', {
        dest: 'quiet',
        action: 'store_true',
        help: 'Suppress automatic printing of pattern space'
    });
    parser.add_argument('rest', {
        nargs: '*',
        help: 'Script and file (if -e not used)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // Get scripts
    let scripts: string[] = parsed.scripts || [];
    let filePath: string | null = null;

    if (scripts.length === 0) {
        if (parsed.rest.length === 0) {
            throw new Error('sed: missing script');
        }
        scripts = [parsed.rest[0]];
        filePath = parsed.rest[1];
    } else {
        filePath = parsed.rest[0];
    }

    // Process each script
    const transformations: Array<{ regex: RegExp; replacement: string; print: boolean }> = [];
    for (const script of scripts) {
        // Parse sed command (support basic s/pattern/replacement/flags)
        const sedMatch = script.match(/^s\/(.+?)\/(.*)\/([gip]*)$/);
        if (!sedMatch) {
            throw new Error(`sed: unsupported command: ${script}`);
        }

        const [, pattern, replacement, flagsStr] = sedMatch;
        const flags = flagsStr.includes('i') ? 'gi' : 'g';
        const regex = new RegExp(pattern, flags);
        transformations.push({ regex, replacement, print: flagsStr.includes('p') });
    }

    // Get content
    let content: string;
    if (!filePath && stdin !== null && stdin !== undefined) {
        content = stdin;
    } else if (!filePath) {
        throw new Error('sed: missing file operand');
    } else {
        const node = context.fs.resolvePath(filePath);
        if (!node) {
            throw new Error(`sed: can't read ${filePath}: No such file or directory`);
        }
        if (!node.isFile()) {
            throw new Error(`sed: ${filePath}: Is a directory`);
        }
        content = node.read();
    }

    // Apply transformations
    for (const { regex, replacement } of transformations) {
        content = content.replace(regex, replacement);
    }

    // Write back if in-place and file specified
    if (parsed.in_place && filePath) {
        const node = context.fs.resolvePath(filePath);
        if (node && node.isFile()) {
            node.write(content);
        }
    }

    return content;
}
