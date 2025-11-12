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
    isCode?: boolean; // If true, scriptPath is treated as inline code instead of a file path
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
            isCode = false,
        } = options;

        let scriptContent: string;
        let scriptFullPath: string;

        if (isCode) {
            // Treat scriptPath as inline code
            scriptContent = scriptPath;
            scriptFullPath = '<eval>';
        } else {
            // Load from file
            const scriptNode = this.fs.resolvePath(scriptPath);
            if (!scriptNode) {
                throw new Error(`cannot find module '${scriptPath}'`);
            }
            if (!scriptNode.isFile()) {
                throw new Error(`'${scriptPath}' is a directory`);
            }

            scriptContent = scriptNode.read();
            scriptFullPath = scriptNode.getPath();
        }

        this.moduleCache.clear();

        const argv = this.buildArgv(scriptFullPath, positionalArgs, flagArgs);
        const consoleBuffer: string[] = [];

        const consoleProxy = {
            log: (...args: unknown[]) => consoleBuffer.push(args.map((a) => String(a)).join(' ')),
            error: (...args: unknown[]) =>
                consoleBuffer.push(`ERROR: ${args.map((a) => String(a)).join(' ')}`),
            warn: (...args: unknown[]) =>
                consoleBuffer.push(`WARN: ${args.map((a) => String(a)).join(' ')}`),
        };

        let vm: NodeVM;
        const moduleLoader = (modulePath: string) => {
            if (this.moduleCache.has(modulePath)) {
                return this.moduleCache.get(modulePath);
            }
            const node = this.fs.resolvePath(modulePath);
            if (!node || !node.isFile()) {
                throw new Error(`Cannot find module '${modulePath}'`);
            }
            const moduleCode = node.read();
            const moduleDir = this.dirname(modulePath);
            const wrappedModuleCode = this.wrapCodeWithCustomRequire(moduleCode, modulePath);
            const moduleExports = vm.run(wrappedModuleCode, modulePath);
            this.moduleCache.set(modulePath, moduleExports);
            return moduleExports;
        };

        const vmConfig: NodeVMOptions = {
            console: 'off',
            wrapper: 'commonjs',
            wasm: vmOptions.wasm ?? false,
            eval: vmOptions.eval ?? false,
            sandbox: {
                console: consoleProxy,
                process: this.buildProcessProxy(argv, env),
                __moduleLoader: moduleLoader,
            },
            require: {
                external: false,
                builtin: ['path', 'buffer'],
                mock: {
                    fs: this.fsAdapter,
                    'node:fs': this.fsAdapter,
                    'fs/promises': this.fsAdapter.promises,
                    'node:fs/promises': this.fsAdapter.promises,
                },
            },
        };

        if (vmOptions.timeout !== undefined) {
            vmConfig.timeout = vmOptions.timeout;
        }

        vm = new NodeVM(vmConfig);

        const wrappedCode = this.wrapCodeWithCustomRequire(scriptContent, scriptFullPath);
        const moduleExports = vm.run(wrappedCode, scriptFullPath);

        return {
            output: consoleBuffer.join('\n'),
            exports: moduleExports,
        };
    }

    private wrapCodeWithCustomRequire(code: string, filename: string): string {
        const dirname = this.dirname(filename);
        return `
(function() {
    const __originalRequire = require;
    const __fs = __originalRequire('fs');
    const __fsPromises = __originalRequire('fs/promises');
    const __path = __originalRequire('path');
    const __buffer = __originalRequire('buffer');
    
    const __createRequire = (fromDir) => {
        return (moduleName) => {
            if (moduleName === 'fs' || moduleName === 'node:fs') {
                return __fs;
            }
            if (moduleName === 'fs/promises' || moduleName === 'node:fs/promises') {
                return __fsPromises;
            }
            if (moduleName === 'path' || moduleName === 'node:path') {
                return __path;
            }
            if (moduleName === 'buffer' || moduleName === 'node:buffer') {
                return __buffer;
            }
            
            let resolved;
            if (moduleName.startsWith('/')) {
                resolved = __path.normalize(moduleName);
            } else if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
                resolved = __path.normalize(__path.join(fromDir, moduleName));
            } else {
                resolved = __path.normalize(__path.join('/', moduleName));
            }
            
            return __moduleLoader(resolved);
        };
    };
    
    require = __createRequire('${dirname}');
    
    return (function() {
${code}
    })();
})();
`;
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
