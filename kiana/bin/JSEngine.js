"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSEngine = void 0;
const path_1 = require("path");
const vm2_1 = require("vm2");
const MemFSAdapter_1 = require("./MemFSAdapter");
class JSEngine {
    constructor(memfs) {
        this.moduleCache = new Map();
        this.fs = memfs;
        this.fsAdapter = new MemFSAdapter_1.MemFSAdapter(memfs);
    }
    runScript(scriptPath, options = {}) {
        const { positionalArgs = [], flagArgs = {}, env = {}, vmOptions = {}, } = options;
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
        const consoleBuffer = [];
        const consoleProxy = {
            log: (...args) => consoleBuffer.push(args.map((a) => String(a)).join(' ')),
            error: (...args) => consoleBuffer.push(`ERROR: ${args.map((a) => String(a)).join(' ')}`),
            warn: (...args) => consoleBuffer.push(`WARN: ${args.map((a) => String(a)).join(' ')}`),
        };
        let vm;
        const moduleLoader = (modulePath) => {
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
        const vmConfig = {
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
        vm = new vm2_1.NodeVM(vmConfig);
        const wrappedCode = this.wrapCodeWithCustomRequire(scriptNode.read(), scriptFullPath);
        const moduleExports = vm.run(wrappedCode, scriptFullPath);
        return {
            output: consoleBuffer.join('\n'),
            exports: moduleExports,
        };
    }
    wrapCodeWithCustomRequire(code, filename) {
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
    buildProcessProxy(argv, env) {
        const frozenEnv = Object.freeze({ ...env });
        const memfs = this.fs;
        const proxy = {
            argv,
            env: frozenEnv,
            cwd: () => memfs.getCurrentDirectory(),
            chdir: (dir) => memfs.changeDirectory(dir),
            exit: (code = 0) => {
                throw new Error(`process.exit is disabled (attempted exit with code ${code})`);
            },
        };
        return Object.freeze(proxy);
    }
    buildArgv(scriptFullPath, positionalArgs, flagArgs) {
        const args = ['node', scriptFullPath, ...positionalArgs];
        for (const [key, value] of Object.entries(flagArgs)) {
            if (!key) {
                continue;
            }
            const prefix = key.length === 1 ? '-' : '--';
            if (value === true) {
                args.push(`${prefix}${key}`);
            }
            else {
                args.push(`${prefix}${key}`, String(value));
            }
        }
        return Object.freeze(args);
    }
    resolveToAbsolutePath(request, baseDir) {
        if (!request) {
            return baseDir;
        }
        if (request.startsWith('/')) {
            return path_1.posix.normalize(request);
        }
        if (request.startsWith('./') || request.startsWith('../')) {
            return path_1.posix.normalize(path_1.posix.join(baseDir, request));
        }
        return path_1.posix.normalize(path_1.posix.join('/', request));
    }
    dirname(fullPath) {
        if (!fullPath || fullPath === '/') {
            return '/';
        }
        return path_1.posix.dirname(fullPath);
    }
}
exports.JSEngine = JSEngine;
