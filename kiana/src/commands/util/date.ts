/**
 * date - Display or set date and time
 */

import { CommandContext } from '../types';
import { ArgumentParser } from 'argparse';

export function date(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'date',
        description: 'Display or set date and time',
        add_help: true
    });

    parser.add_argument('-u', '--utc', {
        action: 'store_true',
        help: 'Display UTC time'
    });
    parser.add_argument('-I', '--iso-8601', {
        action: 'store_true',
        dest: 'iso',
        help: 'Output ISO 8601 format'
    });
    parser.add_argument('-R', '--rfc-email', {
        action: 'store_true',
        dest: 'rfc',
        help: 'Output RFC 5322 format'
    });
    parser.add_argument('format', {
        nargs: '?',
        help: 'Output format string (e.g., +%Y-%m-%d)'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    const now = new Date();

    // ISO 8601 format
    if (parsed.iso) {
        return now.toISOString();
    }

    // RFC 5322 format
    if (parsed.rfc) {
        return now.toUTCString();
    }

    // Custom format string (simplified, supports common patterns)
    if (parsed.format && parsed.format.startsWith('+')) {
        const format = parsed.format.substring(1);
        let result = format;

        // Common format specifiers
        const replacements: Record<string, string> = {
            '%Y': now.getFullYear().toString(),
            '%m': (now.getMonth() + 1).toString().padStart(2, '0'),
            '%d': now.getDate().toString().padStart(2, '0'),
            '%H': now.getHours().toString().padStart(2, '0'),
            '%M': now.getMinutes().toString().padStart(2, '0'),
            '%S': now.getSeconds().toString().padStart(2, '0'),
            '%a': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()],
            '%A': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
            '%b': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()],
            '%B': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][now.getMonth()],
            '%s': Math.floor(now.getTime() / 1000).toString(), // Unix timestamp
        };

        for (const [pattern, value] of Object.entries(replacements)) {
            result = result.replace(new RegExp(pattern, 'g'), value);
        }

        return result;
    }

    // Default format (similar to Unix date)
    if (parsed.utc) {
        return now.toUTCString();
    }

    // Default local format
    return now.toString();
}
