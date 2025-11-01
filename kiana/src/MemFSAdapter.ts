import { posix as posixPath } from 'path';
import { Buffer } from 'buffer';
import type { constants as FsConstants } from 'fs';
import { MemDirectory, MemFile, MemFS, MemNode } from './MemFS';

type Callback<T = unknown> = (err: NodeJS.ErrnoException | null, result?: T) => void;

interface AsyncArgs<TOptions> {
    cb: Callback;
    opts?: TOptions;
}

interface ReadOptions {
    encoding: BufferEncoding | null;
}

interface WriteOptions {
    encoding: BufferEncoding;
}

interface MkdirOptions {
    recursive?: boolean;
}

interface DirentLike {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
}

export class MemFsStats {
    private readonly node: MemNode;
    public dev = 0;
    public mode: number;
    public nlink = 1;
    public uid = 0;
    public gid = 0;
    public rdev = 0;
    public size: number;
    public blksize = 4096;
    public blocks: number;
    public atime: Date;
    public mtime: Date;
    public ctime: Date;
    public birthtime: Date;

    constructor(node: MemNode) {
        this.node = node;
        this.mode = node.isDirectory() ? 0o40755 : 0o100644;
        this.size = node.isFile() ? node.size() : 0;
        this.blocks = Math.ceil(this.size / this.blksize);
        this.atime = node.modifiedAt;
        this.mtime = node.modifiedAt;
        this.ctime = node.modifiedAt;
        this.birthtime = node.createdAt;
    }

    isFile(): boolean {
        return this.node.isFile();
    }

    isDirectory(): boolean {
        return this.node.isDirectory();
    }

    isSymbolicLink(): boolean {
        return false;
    }

    isBlockDevice(): boolean {
        return false;
    }

    isCharacterDevice(): boolean {
        return false;
    }

    isFIFO(): boolean {
        return false;
    }

    isSocket(): boolean {
        return false;
    }
}

export class MemFSAdapter {
    public readonly fs: MemFS;
    public readonly constants: typeof FsConstants;
    public readonly promises: Record<string, (...args: unknown[]) => Promise<unknown>>;

    constructor(memfs: MemFS) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { constants } = require('fs');
        this.fs = memfs;
        this.constants = constants;
        this.promises = this.buildPromiseAPI();
    }

    readFileSync(filePath: string, options?: BufferEncoding | { encoding?: BufferEncoding | null }): string | Buffer {
        const { encoding } = this.normalizeReadOptions(options);
        const node = this.getFileNode(filePath, 'readFile');
        const data = node.read();
        return encoding ? data : Buffer.from(data, 'utf8');
    }

    readFile(
        filePath: string,
        options: BufferEncoding | { encoding?: BufferEncoding | null } | Callback,
        callback?: Callback,
    ): void {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.readFileSync(filePath, opts as BufferEncoding | { encoding?: BufferEncoding | null }), cb);
    }

    writeFileSync(
        filePath: string,
        data: string | NodeJS.ArrayBufferView,
        options?: BufferEncoding | { encoding?: BufferEncoding | null },
    ): void {
        const { encoding } = this.normalizeWriteOptions(options);
        const content = this.toContent(data, encoding);

        const absPath = this.resolvePath(filePath);
        const node = this.fs.resolvePath(absPath);

        if (node) {
            if (!node.isFile()) {
                this.throwError('EISDIR', `EISDIR: illegal operation on a directory, open '${filePath}'`);
            }
            node.write(content);
        } else {
            this.ensureParentDirectory(absPath);
            this.fs.createFile(absPath, content);
        }
    }

    writeFile(
        filePath: string,
        data: string | NodeJS.ArrayBufferView,
        options: BufferEncoding | { encoding?: BufferEncoding | null } | Callback,
        callback?: Callback,
    ): void {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.writeFileSync(filePath, data, opts as BufferEncoding | { encoding?: BufferEncoding | null }), cb);
    }

    appendFileSync(
        filePath: string,
        data: string | NodeJS.ArrayBufferView,
        options?: BufferEncoding | { encoding?: BufferEncoding | null },
    ): void {
        const { encoding } = this.normalizeWriteOptions(options);
        const content = this.toContent(data, encoding);

        const absPath = this.resolvePath(filePath);
        const node = this.fs.resolvePath(absPath);

        if (node) {
            if (!node.isFile()) {
                this.throwError('EISDIR', `EISDIR: illegal operation on a directory, open '${filePath}'`);
            }
            node.append(content);
        } else {
            this.ensureParentDirectory(absPath);
            this.fs.createFile(absPath, content);
        }
    }

    appendFile(
        filePath: string,
        data: string | NodeJS.ArrayBufferView,
        options: BufferEncoding | { encoding?: BufferEncoding | null } | Callback,
        callback?: Callback,
    ): void {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.appendFileSync(filePath, data, opts as BufferEncoding | { encoding?: BufferEncoding | null }), cb);
    }

    existsSync(filePath: string): boolean {
        const abs = this.resolvePath(filePath);
        return Boolean(this.fs.resolvePath(abs));
    }

    mkdirSync(dirPath: string, options: MkdirOptions | number = {}): void {
        const abs = this.resolvePath(dirPath);
        const recursive = this.extractRecursive(options);

        if (recursive) {
            this.fs.createDirectories(abs);
        } else {
            this.fs.createDirectory(abs);
        }
    }

    mkdir(dirPath: string, options: MkdirOptions | Callback | undefined, callback?: Callback): void {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.mkdirSync(dirPath, opts as MkdirOptions), cb);
    }

    readdirSync(
        dirPath: string,
        options: { encoding?: BufferEncoding; withFileTypes?: false },
    ): string[];
    readdirSync(
        dirPath: string,
        options: { encoding: 'buffer'; withFileTypes?: false },
    ): Buffer[];
    readdirSync(
        dirPath: string,
        options: { withFileTypes: true },
    ): DirentLike[];
    readdirSync(dirPath = '.', options: Record<string, unknown> = {}): unknown {
        const abs = this.resolvePath(dirPath);
        const node = this.fs.resolvePath(abs);
        if (!node) {
            this.throwENOENT('scandir', dirPath);
        }
        if (!node.isDirectory()) {
            this.throwError('ENOTDIR', `ENOTDIR: not a directory, scandir '${dirPath}'`);
        }

        if (options.withFileTypes) {
            return node.listChildren().map((child) => ({
                name: child.name,
                isFile: () => child.isFile(),
                isDirectory: () => child.isDirectory(),
                isSymbolicLink: () => false,
            }));
        }

        const entries = node.listChildren().map((child) => child.name);

        if (options.encoding && options.encoding !== 'utf8') {
            return entries.map((name) => Buffer.from(name, 'utf8'));
        }

        return entries;
    }

    readdir(
        dirPath: string,
        options: Record<string, unknown> | Callback,
        callback?: Callback,
    ): void {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.readdirSync(dirPath, opts as Record<string, unknown>), cb);
    }

    statSync(filePath: string): MemFsStats {
        return this.getStats(filePath, 'stat');
    }

    stat(filePath: string, options: Record<string, unknown> | Callback, callback?: Callback): void {
        const { cb } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.statSync(filePath), cb);
    }

    lstatSync(filePath: string): MemFsStats {
        return this.statSync(filePath);
    }

    lstat(filePath: string, options: Record<string, unknown> | Callback, callback?: Callback): void {
        this.stat(filePath, options, callback);
    }

    unlinkSync(filePath: string): void {
        const abs = this.resolvePath(filePath);
        const node = this.fs.resolvePath(abs);

        if (!node) {
            this.throwENOENT('unlink', filePath);
        }
        if (!node.isFile()) {
            this.throwError('EISDIR', `EISDIR: illegal operation on a directory, unlink '${filePath}'`);
        }

        this.fs.remove(abs);
    }

    unlink(filePath: string, callback: Callback): void {
        this.asyncWrap(() => this.unlinkSync(filePath), callback);
    }

    rmdirSync(dirPath: string, options: MkdirOptions | Callback = {}): void {
        const abs = this.resolvePath(dirPath);
        const recursive = this.extractRecursive(options);

        const node = this.fs.resolvePath(abs);
        if (!node) {
            this.throwENOENT('rmdir', dirPath);
        }
        if (!node.isDirectory()) {
            this.throwError('ENOTDIR', `ENOTDIR: not a directory, rmdir '${dirPath}'`);
        }

        this.fs.remove(abs, recursive);
    }

    rmdir(dirPath: string, options: MkdirOptions | Callback, callback?: Callback): void {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.rmdirSync(dirPath, opts as MkdirOptions), cb);
    }

    renameSync(oldPath: string, newPath: string): void {
        const oldAbs = this.resolvePath(oldPath);
        const newAbs = this.resolvePath(newPath);
        const node = this.fs.resolvePath(oldAbs);

        if (!node) {
            this.throwENOENT('rename', oldPath);
        }

        if (node.isDirectory()) {
            this.moveDirectory(oldAbs, newAbs);
        } else {
            this.moveFile(oldAbs, newAbs);
        }
    }

    rename(oldPath: string, newPath: string, callback: Callback): void {
        this.asyncWrap(() => this.renameSync(oldPath, newPath), callback);
    }

    private moveFile(oldAbs: string, newAbs: string): void {
        const fileNode = this.fs.resolvePath(oldAbs);
        if (!fileNode || !fileNode.isFile()) {
            this.throwENOENT('rename', oldAbs);
        }
        const content = fileNode.read();
        this.ensureParentDirectory(newAbs);

        const existing = this.fs.resolvePath(newAbs);
        if (existing) {
            if (existing.isDirectory()) {
                this.throwError('EISDIR', `EISDIR: illegal operation on a directory, rename '${newAbs}'`);
            }
            this.fs.remove(newAbs);
        }

        this.fs.createFile(newAbs, content);
        this.fs.remove(oldAbs);
    }

    private moveDirectory(oldAbs: string, newAbs: string): void {
        const dest = this.fs.resolvePath(newAbs);
        if (dest) {
            this.throwError('EEXIST', `EEXIST: file already exists, mkdir '${newAbs}'`);
        }

        this.ensureParentDirectory(newAbs);
        this.fs.createDirectory(newAbs);

        const oldNode = this.fs.resolvePath(oldAbs);
        if (!oldNode || !oldNode.isDirectory()) {
            this.throwENOENT('rename', oldAbs);
        }

        for (const child of oldNode.listChildren()) {
            const childOldPath = `${oldAbs === '/' ? '' : oldAbs}/${child.name}`;
            const childNewPath = `${newAbs === '/' ? '' : newAbs}/${child.name}`;
            if (child.isDirectory()) {
                this.moveDirectory(childOldPath, childNewPath);
            } else {
                this.moveFile(childOldPath, childNewPath);
            }
        }

        this.fs.remove(oldAbs, true);
    }

    private buildPromiseAPI(): Record<string, (...args: unknown[]) => Promise<unknown>> {
        return {
            readFile: (...args) => this.promiseWrap(this.readFile.bind(this) as any, args),
            writeFile: (...args) => this.promiseWrap(this.writeFile.bind(this) as any, args),
            appendFile: (...args) => this.promiseWrap(this.appendFile.bind(this) as any, args),
            mkdir: (...args) => this.promiseWrap(this.mkdir.bind(this) as any, args),
            readdir: (...args) => this.promiseWrap(this.readdir.bind(this) as any, args),
            stat: (...args) => this.promiseWrap(this.stat.bind(this) as any, args),
            lstat: (...args) => this.promiseWrap(this.lstat.bind(this) as any, args),
            unlink: (...args) => this.promiseWrap(this.unlink.bind(this) as any, args),
            rmdir: (...args) => this.promiseWrap(this.rmdir.bind(this) as any, args),
            rename: (...args) => this.promiseWrap(this.rename.bind(this) as any, args),
        };
    }

    private promiseWrap(
        fn: any,
        args: unknown[],
    ): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const callback: Callback = (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            };
            fn(...args, callback);
        });
    }

    private asyncWrap<T>(fn: () => T, callback: Callback<T> = () => {}): void {
        try {
            const result = fn();
            callback(null, result);
        } catch (err) {
            callback(err as NodeJS.ErrnoException);
        }
    }

    private normalizeReadOptions(
        options?: BufferEncoding | { encoding?: BufferEncoding | null },
    ): ReadOptions {
        if (typeof options === 'string') {
            return { encoding: options };
        }
        if (options && typeof options === 'object') {
            return { encoding: options.encoding ?? null };
        }
        return { encoding: null };
    }

    private normalizeWriteOptions(
        options?: BufferEncoding | { encoding?: BufferEncoding | null },
    ): WriteOptions {
        if (typeof options === 'string') {
            return { encoding: options };
        }
        if (options && typeof options === 'object' && options.encoding) {
            return { encoding: options.encoding };
        }
        return { encoding: 'utf8' };
    }

    private normalizeAsyncArgs<TOptions>(
        options: TOptions | Callback | undefined,
        callback?: Callback,
    ): AsyncArgs<TOptions> {
        if (typeof options === 'function') {
            return { cb: options as Callback, opts: undefined };
        }
        return { cb: callback ?? (() => {}), opts: options };
    }

    private extractRecursive(options: MkdirOptions | Callback | number | undefined): boolean {
        if (!options) {
            return false;
        }
        if (typeof options === 'boolean') {
            return options;
        }
        if (typeof options === 'number') {
            return Boolean(options);
        }
        if (typeof options === 'function') {
            return false;
        }
        return Boolean(options.recursive);
    }

    private toContent(
        data: string | NodeJS.ArrayBufferView,
        encoding: BufferEncoding,
    ): string {
        if (Buffer.isBuffer(data)) {
            return data.toString('utf8');
        }
        if (typeof data === 'string') {
            return encoding === 'utf8' ? data : Buffer.from(data, encoding).toString('utf8');
        }
        return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
    }

    private getFileNode(filePath: string, syscall: string): MemFile {
        const abs = this.resolvePath(filePath);
        const node = this.fs.resolvePath(abs);
        if (!node || !node.isFile()) {
            this.throwENOENT(syscall, filePath);
        }
        return node;
    }

    private getStats(filePath: string, syscall: string): MemFsStats {
        const abs = this.resolvePath(filePath);
        const node = this.fs.resolvePath(abs);

        if (!node) {
            this.throwENOENT(syscall, filePath);
        }

        return new MemFsStats(node);
    }

    private ensureParentDirectory(absPath: string): void {
        const dirPath = this.dirname(absPath);
        const dirNode = this.fs.resolvePath(dirPath);
        if (!dirNode || !dirNode.isDirectory()) {
            this.throwENOENT('mkdir', dirPath);
        }
    }

    private dirname(absPath: string): string {
        const normalized = posixPath.normalize(absPath);
        if (normalized === '/' || normalized === '') {
            return '/';
        }
        const idx = normalized.lastIndexOf('/');
        if (idx <= 0) {
            return '/';
        }
        return normalized.slice(0, idx);
    }

    private resolvePath(inputPath: string): string {
        if (!inputPath) {
            this.throwError('ENOENT', 'Invalid path');
        }

        if (posixPath.isAbsolute(inputPath)) {
            return posixPath.normalize(inputPath);
        }

        const cwd = this.fs.getCurrentDirectory();
        const base = cwd === '/' ? '' : cwd;
        return posixPath.normalize(posixPath.join(base, inputPath));
    }

    private throwError(code: string, message: string): never {
        const error = new Error(message) as NodeJS.ErrnoException;
        error.code = code;
        throw error;
    }

    private throwENOENT(syscall: string, targetPath: string): never {
        const error = new Error(`ENOENT: no such file or directory, ${syscall} '${targetPath}'`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        error.syscall = syscall;
        error.path = targetPath;
        throw error;
    }
}
