/**
 * node - execute JavaScript file in the memory filesystem
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function node(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'node',
        description: 'Execute JavaScript file',
        add_help: true
    });

    parser.add_argument('--timeout', {
        type: 'int',
        metavar: 'MS',
        help: 'Set execution timeout in milliseconds'
    });
    parser.add_argument('--allow-eval', {
        action: 'store_true',
        help: 'Allow eval() in scripts (default: false)'
    });
    parser.add_argument('--allow-wasm', {
        action: 'store_true',
        help: 'Allow WebAssembly in scripts (default: false)'
    });
    parser.add_argument('-e', '--env', {
        action: 'append',
        dest: 'env_vars',
        metavar: 'KEY=VALUE',
        help: 'Set environment variable (can be used multiple times)'
    });
    parser.add_argument('script', {
        help: 'JavaScript file to execute'
    });
    parser.add_argument('args', {
        nargs: '*',
        help: 'Arguments to pass to script'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // Parse environment variables
    const env: Record<string, string> = {};
    if (parsed.env_vars) {
        for (const envVar of parsed.env_vars) {
            const [key, ...valueParts] = envVar.split('=');
            if (key) {
                env[key] = valueParts.join('=') || '';
            }
        }
    }

    // Build VM options
    const vmOptions: any = {};
    if (parsed.timeout !== undefined && parsed.timeout !== null) {
        vmOptions.timeout = parsed.timeout;
    }
    if (parsed.allow_eval) {
        vmOptions.eval = true;
    }
    if (parsed.allow_wasm) {
        vmOptions.wasm = true;
    }

    try {
        const result = context.jsEngine.runScript(parsed.script, {
            positionalArgs: parsed.args,
            flagArgs: {},
            env,
            vmOptions,
        });
        return result.output;
    } catch (err: any) {
        throw new Error(`node: execution error: ${err.message}`);
    }
}
