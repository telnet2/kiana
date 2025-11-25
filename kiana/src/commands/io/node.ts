/**
 * node - execute JavaScript file in the memory filesystem
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

export function node(context: CommandContext, args: string[]): string {
    const parser = new ArgumentParser({
        prog: 'node',
        description: 'Execute JavaScript file or code',
        add_help: true
    });

    parser.add_argument('-e', '--eval', {
        metavar: 'CODE',
        help: 'Evaluate and execute JavaScript code'
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
    parser.add_argument('--env', {
        action: 'append',
        dest: 'env_vars',
        metavar: 'KEY=VALUE',
        help: 'Set environment variable (can be used multiple times)'
    });
    parser.add_argument('script', {
        nargs: '?',
        help: 'JavaScript file to execute (not needed with -e)'
    });
    parser.add_argument('args', {
        nargs: '*',
        help: 'Arguments to pass to script'
    });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    // Validate that either -e or script is provided
    if (!parsed.eval && !parsed.script) {
        throw new Error('node: either -e <code> or a script file must be provided');
    }

    // Validate that both are not provided
    if (parsed.eval && parsed.script) {
        throw new Error('node: cannot specify both -e and a script file');
    }

    // Parse environment variables from session first, then CLI overrides
    const env: Record<string, string> = {
        ...context.session.getAllEnv()
    };

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
        // Set working directory from session before running script
        const sessionCwd = context.session.getCwd();
        const previousCwd = context.fs.getCurrentDirectory();

        try {
            context.fs.changeDirectory(sessionCwd);

            let result;
            if (parsed.eval) {
                // Run inline code
                result = context.jsEngine.runScript(parsed.eval, {
                    positionalArgs: parsed.args || [],
                    flagArgs: {},
                    env,
                    vmOptions,
                    isCode: true,
                });
            } else {
                // Run script file
                result = context.jsEngine.runScript(parsed.script, {
                    positionalArgs: parsed.args || [],
                    flagArgs: {},
                    env,
                    vmOptions,
                    isCode: false,
                });
            }
            return result.output;
        } finally {
            // Restore previous working directory
            try {
                context.fs.changeDirectory(previousCwd);
            } catch (e) {
                // Ignore if we can't restore
            }
        }
    } catch (err: any) {
        throw new Error(`node: execution error: ${err.message}`);
    }
}
