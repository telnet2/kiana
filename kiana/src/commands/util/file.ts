/**
 * file - determine file type
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function file(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'file',
        description: 'Determine file type',
        add_help: true
    });

    parser.add_argument('-b', '--brief', {
        action: 'store_true',
        help: 'Do not prepend filenames to output lines'
    });

    parser.add_argument('files', {
        nargs: '+',
        help: 'File(s) to examine'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const brief = parsed.brief;
    const files = parsed.files;

    if (!files || files.length === 0) {
        throw new Error('file: missing operand');
    }

    const results: string[] = [];

    for (const filePath of files) {
        const node = context.fs.resolvePath(filePath);

        if (!node) {
            const output = brief ? 'cannot open' : `${filePath}: cannot open`;
            results.push(output);
            continue;
        }

        let fileType = '';

        if (node.isDirectory()) {
            fileType = 'directory';
        } else if (node.isFile()) {
            const content = node.read();

            // Detect file type by content and extension
            if (content.length === 0) {
                fileType = 'empty';
            } else if (filePath.endsWith('.json')) {
                // Try to parse as JSON
                try {
                    JSON.parse(content);
                    fileType = 'JSON data';
                } catch {
                    fileType = 'ASCII text';
                }
            } else if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
                fileType = 'JavaScript source code';
            } else if (filePath.endsWith('.txt')) {
                fileType = 'ASCII text';
            } else if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
                fileType = 'markdown document';
            } else if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
                fileType = 'HTML document';
            } else if (filePath.endsWith('.css')) {
                fileType = 'CSS stylesheet';
            } else if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
                fileType = 'YAML document';
            } else if (filePath.endsWith('.xml')) {
                fileType = 'XML document';
            } else if (filePath.endsWith('.csv')) {
                fileType = 'CSV data';
            } else if (filePath.endsWith('.sh') || filePath.endsWith('.bash')) {
                fileType = 'shell script';
            } else if (filePath.endsWith('.py')) {
                fileType = 'Python script';
            } else if (filePath.endsWith('.jar') || filePath.endsWith('.zip')) {
                fileType = 'archive';
            } else {
                // Check content for common patterns
                if (content.startsWith('{') || content.startsWith('[')) {
                    try {
                        JSON.parse(content);
                        fileType = 'JSON data';
                    } catch {
                        fileType = 'ASCII text';
                    }
                } else if (content.includes('<?xml')) {
                    fileType = 'XML document';
                } else if (content.includes('#!/')) {
                    fileType = 'shell script';
                } else if (/^[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(content)) {
                    fileType = 'binary';
                } else {
                    fileType = 'ASCII text';
                }
            }
        }

        const output = brief ? fileType : `${filePath}: ${fileType}`;
        results.push(output);
    }

    return results.join('\n');
}
