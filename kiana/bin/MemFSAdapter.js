"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemFSAdapter = exports.MemFsStats = void 0;
const path_1 = require("path");
const buffer_1 = require("buffer");
class MemFsStats {
    constructor(node) {
        this.dev = 0;
        this.nlink = 1;
        this.uid = 0;
        this.gid = 0;
        this.rdev = 0;
        this.blksize = 4096;
        this.node = node;
        this.mode = node.isDirectory() ? 0o40755 : 0o100644;
        this.size = node.isFile() ? node.size() : 0;
        this.blocks = Math.ceil(this.size / this.blksize);
        this.atime = node.modifiedAt;
        this.mtime = node.modifiedAt;
        this.ctime = node.modifiedAt;
        this.birthtime = node.createdAt;
    }
    isFile() {
        return this.node.isFile();
    }
    isDirectory() {
        return this.node.isDirectory();
    }
    isSymbolicLink() {
        return false;
    }
    isBlockDevice() {
        return false;
    }
    isCharacterDevice() {
        return false;
    }
    isFIFO() {
        return false;
    }
    isSocket() {
        return false;
    }
}
exports.MemFsStats = MemFsStats;
class MemFSAdapter {
    constructor(memfs) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { constants } = require('fs');
        this.fs = memfs;
        this.constants = constants;
        this.promises = this.buildPromiseAPI();
    }
    readFileSync(filePath, options) {
        const { encoding } = this.normalizeReadOptions(options);
        const node = this.getFileNode(filePath, 'readFile');
        const data = node.read();
        return encoding ? data : buffer_1.Buffer.from(data, 'utf8');
    }
    readFile(filePath, options, callback) {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.readFileSync(filePath, opts), cb);
    }
    writeFileSync(filePath, data, options) {
        const { encoding } = this.normalizeWriteOptions(options);
        const content = this.toContent(data, encoding);
        const absPath = this.resolvePath(filePath);
        const node = this.fs.resolvePath(absPath);
        if (node) {
            if (!node.isFile()) {
                this.throwError('EISDIR', `EISDIR: illegal operation on a directory, open '${filePath}'`);
            }
            node.write(content);
        }
        else {
            this.ensureParentDirectory(absPath);
            this.fs.createFile(absPath, content);
        }
    }
    writeFile(filePath, data, options, callback) {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.writeFileSync(filePath, data, opts), cb);
    }
    appendFileSync(filePath, data, options) {
        const { encoding } = this.normalizeWriteOptions(options);
        const content = this.toContent(data, encoding);
        const absPath = this.resolvePath(filePath);
        const node = this.fs.resolvePath(absPath);
        if (node) {
            if (!node.isFile()) {
                this.throwError('EISDIR', `EISDIR: illegal operation on a directory, open '${filePath}'`);
            }
            node.append(content);
        }
        else {
            this.ensureParentDirectory(absPath);
            this.fs.createFile(absPath, content);
        }
    }
    appendFile(filePath, data, options, callback) {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.appendFileSync(filePath, data, opts), cb);
    }
    existsSync(filePath) {
        const abs = this.resolvePath(filePath);
        return Boolean(this.fs.resolvePath(abs));
    }
    mkdirSync(dirPath, options = {}) {
        const abs = this.resolvePath(dirPath);
        const recursive = this.extractRecursive(options);
        if (recursive) {
            this.fs.createDirectories(abs);
        }
        else {
            this.fs.createDirectory(abs);
        }
    }
    mkdir(dirPath, options, callback) {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.mkdirSync(dirPath, opts), cb);
    }
    readdirSync(dirPath = '.', options = {}) {
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
            return entries.map((name) => buffer_1.Buffer.from(name, 'utf8'));
        }
        return entries;
    }
    readdir(dirPath, options, callback) {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.readdirSync(dirPath, opts), cb);
    }
    statSync(filePath) {
        return this.getStats(filePath, 'stat');
    }
    stat(filePath, options, callback) {
        const { cb } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.statSync(filePath), cb);
    }
    lstatSync(filePath) {
        return this.statSync(filePath);
    }
    lstat(filePath, options, callback) {
        this.stat(filePath, options, callback);
    }
    unlinkSync(filePath) {
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
    unlink(filePath, callback) {
        this.asyncWrap(() => this.unlinkSync(filePath), callback);
    }
    rmdirSync(dirPath, options = {}) {
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
    rmdir(dirPath, options, callback) {
        const { cb, opts } = this.normalizeAsyncArgs(options, callback);
        this.asyncWrap(() => this.rmdirSync(dirPath, opts), cb);
    }
    renameSync(oldPath, newPath) {
        const oldAbs = this.resolvePath(oldPath);
        const newAbs = this.resolvePath(newPath);
        const node = this.fs.resolvePath(oldAbs);
        if (!node) {
            this.throwENOENT('rename', oldPath);
        }
        if (node.isDirectory()) {
            this.moveDirectory(oldAbs, newAbs);
        }
        else {
            this.moveFile(oldAbs, newAbs);
        }
    }
    rename(oldPath, newPath, callback) {
        this.asyncWrap(() => this.renameSync(oldPath, newPath), callback);
    }
    moveFile(oldAbs, newAbs) {
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
    moveDirectory(oldAbs, newAbs) {
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
            }
            else {
                this.moveFile(childOldPath, childNewPath);
            }
        }
        this.fs.remove(oldAbs, true);
    }
    buildPromiseAPI() {
        return {
            readFile: (...args) => this.promiseWrap(this.readFile.bind(this), args),
            writeFile: (...args) => this.promiseWrap(this.writeFile.bind(this), args),
            appendFile: (...args) => this.promiseWrap(this.appendFile.bind(this), args),
            mkdir: (...args) => this.promiseWrap(this.mkdir.bind(this), args),
            readdir: (...args) => this.promiseWrap(this.readdir.bind(this), args),
            stat: (...args) => this.promiseWrap(this.stat.bind(this), args),
            lstat: (...args) => this.promiseWrap(this.lstat.bind(this), args),
            unlink: (...args) => this.promiseWrap(this.unlink.bind(this), args),
            rmdir: (...args) => this.promiseWrap(this.rmdir.bind(this), args),
            rename: (...args) => this.promiseWrap(this.rename.bind(this), args),
        };
    }
    promiseWrap(fn, args) {
        return new Promise((resolve, reject) => {
            const callback = (err, result) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            };
            fn(...args, callback);
        });
    }
    asyncWrap(fn, callback = () => { }) {
        try {
            const result = fn();
            callback(null, result);
        }
        catch (err) {
            callback(err);
        }
    }
    normalizeReadOptions(options) {
        if (typeof options === 'string') {
            return { encoding: options };
        }
        if (options && typeof options === 'object') {
            return { encoding: options.encoding ?? null };
        }
        return { encoding: null };
    }
    normalizeWriteOptions(options) {
        if (typeof options === 'string') {
            return { encoding: options };
        }
        if (options && typeof options === 'object' && options.encoding) {
            return { encoding: options.encoding };
        }
        return { encoding: 'utf8' };
    }
    normalizeAsyncArgs(options, callback) {
        if (typeof options === 'function') {
            return { cb: options, opts: undefined };
        }
        return { cb: callback ?? (() => { }), opts: options };
    }
    extractRecursive(options) {
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
    toContent(data, encoding) {
        if (buffer_1.Buffer.isBuffer(data)) {
            return data.toString('utf8');
        }
        if (typeof data === 'string') {
            return encoding === 'utf8' ? data : buffer_1.Buffer.from(data, encoding).toString('utf8');
        }
        return buffer_1.Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
    }
    getFileNode(filePath, syscall) {
        const abs = this.resolvePath(filePath);
        const node = this.fs.resolvePath(abs);
        if (!node || !node.isFile()) {
            this.throwENOENT(syscall, filePath);
        }
        return node;
    }
    getStats(filePath, syscall) {
        const abs = this.resolvePath(filePath);
        const node = this.fs.resolvePath(abs);
        if (!node) {
            this.throwENOENT(syscall, filePath);
        }
        return new MemFsStats(node);
    }
    ensureParentDirectory(absPath) {
        const dirPath = this.dirname(absPath);
        const dirNode = this.fs.resolvePath(dirPath);
        if (!dirNode || !dirNode.isDirectory()) {
            this.throwENOENT('mkdir', dirPath);
        }
    }
    dirname(absPath) {
        const normalized = path_1.posix.normalize(absPath);
        if (normalized === '/' || normalized === '') {
            return '/';
        }
        const idx = normalized.lastIndexOf('/');
        if (idx <= 0) {
            return '/';
        }
        return normalized.slice(0, idx);
    }
    resolvePath(inputPath) {
        if (!inputPath) {
            this.throwError('ENOENT', 'Invalid path');
        }
        if (path_1.posix.isAbsolute(inputPath)) {
            return path_1.posix.normalize(inputPath);
        }
        const cwd = this.fs.getCurrentDirectory();
        const base = cwd === '/' ? '' : cwd;
        return path_1.posix.normalize(path_1.posix.join(base, inputPath));
    }
    throwError(code, message) {
        const error = new Error(message);
        error.code = code;
        throw error;
    }
    throwENOENT(syscall, targetPath) {
        const error = new Error(`ENOENT: no such file or directory, ${syscall} '${targetPath}'`);
        error.code = 'ENOENT';
        error.syscall = syscall;
        error.path = targetPath;
        throw error;
    }
}
exports.MemFSAdapter = MemFSAdapter;
