"use strict";
/**
 * node - execute JavaScript file in the memory filesystem
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.node = node;
const argparse_1 = require("argparse");
function node(context, args) {
    const parser = new argparse_1.ArgumentParser({
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
    if (typeof parsed === 'string')
        return parsed; // Help text
    // Parse environment variables from session first, then CLI overrides
    const env = {
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
    const vmOptions = {};
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
            const result = context.jsEngine.runScript(parsed.script, {
                positionalArgs: parsed.args,
                flagArgs: {},
                env,
                vmOptions,
            });
            return result.output;
        }
        finally {
            // Restore previous working directory
            try {
                context.fs.changeDirectory(previousCwd);
            }
            catch (e) {
                // Ignore if we can't restore
            }
        }
    }
    catch (err) {
        throw new Error(`node: execution error: ${err.message}`);
    }
}
