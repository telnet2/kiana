import { posix as posixPath } from 'path';
import { NodeVM, type NodeVMOptions } from 'vm2';
import type { MemNode, MemDirectory } from './MemFS';
import { MemFS } from './MemFS';
import { MemFSAdapter } from './MemFSAdapter';

export interface RunScriptOptions {
    positionalArgs?: string[];
    flagArgs?: Record<string, string | number | boolean>;
    env?: Record<string, string>;
    vmOptions?: Partial<NodeVMOptions & { timeout?: number }>;
}

export interface ScriptExecutionResult {
    output: string;
    exports: unknown;
}

type SandboxEnv = Record<string, string>;

export class JSEngine {
    private readonly fs: MemFS;
    private readonly fsAdapter: MemFSAdapter;
    private readonly moduleCache = new Map<string, unknown>();

    constructor(memfs: MemFS) {
        this.fs = memfs;
        this.fsAdapter = new MemFSAdapter(memfs);
    }

    runScript(scriptPath: string, options: RunScriptOptions = {}): ScriptExecutionResult {
        const {
            positionalArgs = [],
            flagArgs = {},
            env = {},
            vmOptions = {},
        } = options;

        const scriptNode = this.fs.resolvePath(scriptPath);
        if (!scriptNode) {
            throw new Error(`cannot find module '${scriptPath}'`);
        }
        if (!scriptNode.isFile()) {
            throw new Error(`'${scriptPath}' is a directory`);
        }

        this.moduleCache.clear();

        const scriptFullPath = scriptNode.getPath();
        const scriptDir = this.dirname(scriptFullPath);
        const argv = this.buildArgv(scriptFullPath, positionalArgs, flagArgs);
        const consoleBuffer: string[] = [];

        const consoleProxy = {
            log: (...args: unknown[]) => consoleBuffer.push(args.map((a) => String(a)).join(' ')),
            error: (...args: unknown[]) =>
                consoleBuffer.push(`ERROR: ${args.map((a) => String(a)).join(' ')}`),
            warn: (...args: unknown[]) =>
                consoleBuffer.push(`WARN: ${args.map((a) => String(a)).join(' ')}`),
        };

        const vmConfig: NodeVMOptions = {
            console: 'off',
            wrapper: 'commonjs',
            wasm: vmOptions.wasm ?? false,
            eval: vmOptions.eval ?? false,
            sandbox: {
                console: consoleProxy,
                process: this.buildProcessProxy(argv, env),
            },
            require: {
                external: false,
                builtin: [],
            },
        };

        if (vmOptions.timeout !== undefined) {
            vmConfig.timeout = vmOptions.timeout;
        }

        const vm = new NodeVM(vmConfig);
        const customRequire = this.createRequireForModule(vm, scriptDir, this.fsAdapter, this.moduleCache);
        const moduleExports = vm.run(scriptNode.read(), scriptFullPath);

        return {
            output: consoleBuffer.join('\n'),
            exports: moduleExports,
        };
    }

    private buildProcessProxy(argv: readonly string[], env: SandboxEnv): NodeJS.Process {
        const frozenEnv = Object.freeze({ ...env });
        const memfs = this.fs;

        const proxy = {
            argv,
            env: frozenEnv,
            cwd: () => memfs.getCurrentDirectory(),
            chdir: (dir: string) => memfs.changeDirectory(dir),
            exit: (code = 0) => {
                throw new Error(`process.exit is disabled (attempted exit with code ${code})`);
            },
        };

        return Object.freeze(proxy) as unknown as NodeJS.Process;
    }

    private createRequireForModule(
        vm: NodeVM,
        dirname: string,
        fsAdapter: MemFSAdapter,
        moduleCache: Map<string, unknown>,
    ): (moduleName: string) => unknown {
        return (moduleName: string) => {
            if (moduleName === 'fs' || moduleName === 'node:fs') {
                return fsAdapter;
            }
            if (moduleName === 'fs/promises' || moduleName === 'node:fs/promises') {
                return fsAdapter.promises;
            }
            if (moduleName === 'path' || moduleName === 'node:path') {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require('path');
            }
            if (moduleName === 'buffer' || moduleName === 'node:buffer') {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require('buffer');
            }

            const resolved = this.resolveToAbsolutePath(moduleName, dirname);
            const node = this.fs.resolvePath(resolved);
            if (!node || !node.isFile()) {
                throw new Error(`Cannot find module '${moduleName}'`);
            }

            const modulePath = node.getPath();
            if (moduleCache.has(modulePath)) {
                return moduleCache.get(modulePath);
            }

            const moduleDir = this.dirname(modulePath);
            const moduleRequire = this.createRequireForModule(vm, moduleDir, fsAdapter, moduleCache);
            const moduleExports = vm.run(node.read(), modulePath);

            moduleCache.set(modulePath, moduleExports);
            return moduleExports;
        };
    }

    private buildArgv(
        scriptFullPath: string,
        positionalArgs: string[],
        flagArgs: Record<string, string | number | boolean>,
    ): readonly string[] {
        const args: string[] = ['node', scriptFullPath, ...positionalArgs];
        for (const [key, value] of Object.entries(flagArgs)) {
            if (!key) {
                continue;
            }
            const prefix = key.length === 1 ? '-' : '--';
            if (value === true) {
                args.push(`${prefix}${key}`);
            } else {
                args.push(`${prefix}${key}`, String(value));
            }
        }
        return Object.freeze(args);
    }

    private resolveToAbsolutePath(request: string, baseDir: string): string {
        if (!request) {
            return baseDir;
        }
        if (request.startsWith('/')) {
            return posixPath.normalize(request);
        }
        if (request.startsWith('./') || request.startsWith('../')) {
            return posixPath.normalize(posixPath.join(baseDir, request));
        }
        return posixPath.normalize(posixPath.join('/', request));
    }

    private dirname(fullPath: string): string {
        if (!fullPath || fullPath === '/') {
            return '/';
        }
        return posixPath.dirname(fullPath);
    }
}
