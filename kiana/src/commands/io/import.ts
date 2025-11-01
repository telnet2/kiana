/**
 * import - import file or directory from real filesystem
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function importCommand(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'import',
        description: 'Import file or directory from real filesystem',
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
        help: 'Real filesystem path to import'
    });
    parser.add_argument('destination', {
        nargs: '?',
        help: 'Memory filesystem destination path'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    try {
        const fs = require('fs');
        const stats = fs.statSync(parsed.source);

        if (stats.isDirectory()) {
            if (!parsed.recursive) {
                throw new Error('import: omitting directory (use -r or -R for recursive)');
            }
            context.fs.importDirectory(parsed.source, parsed.destination);
        } else {
            context.fs.importFile(parsed.source, parsed.destination);
        }

        return `Imported: ${parsed.source}`;
    } catch (err: any) {
        throw new Error(`import: ${err.message}`);
    }
}
