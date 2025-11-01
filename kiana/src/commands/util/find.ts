/**
 * find - Search for files in directory hierarchy
 */

import { CommandContext } from '../types';
import { ArgumentParser } from 'argparse';
import { MemNode } from '../../MemFS';

export function find(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
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
    if (typeof parsed === 'string') return parsed; // Help text
    const node = context.fs.resolvePath(parsed.path);

    if (!node) {
        throw new Error(`find: '${parsed.path}': No such file or directory`);
    }

    const results: string[] = [];
    const namePattern = parsed.name ? new RegExp(parsed.name.replace(/\*/g, '.*').replace(/\?/g, '.')) : null;
    const typeFilter = parsed.type;
    const maxDepth = parsed.maxdepth;

    const traverse = (current: MemNode, basePath: string | null, depth: number = 0): void => {
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
