"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _MemFS_instances, _MemFS_normalizeStartNode, _MemFS_seedFromDirectory, _MemFS_seedFromTar;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemFS = exports.MemDirectory = exports.MemFile = exports.MemNode = void 0;
const fs = require("fs");
const path = require("path");
class MemNode {
    constructor(name, parent = null) {
        this.name = name;
        this.parent = parent;
        this.createdAt = new Date();
        this.modifiedAt = new Date();
    }
    getPath() {
        if (!this.parent) {
            return '/';
        }
        const parentPath = this.parent.getPath();
        return parentPath === '/' ? `/${this.name}` : `${parentPath}/${this.name}`;
    }
    isFile() {
        return this instanceof MemFile;
    }
    isDirectory() {
        return this instanceof MemDirectory;
    }
}
exports.MemNode = MemNode;
class MemFile extends MemNode {
    constructor(name, content = '', parent = null) {
        super(name, parent);
        this.content = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    }
    write(content) {
        this.content = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
        this.modifiedAt = new Date();
    }
    append(content) {
        const appendBuffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
        this.content = Buffer.concat([this.content, appendBuffer]);
        this.modifiedAt = new Date();
    }
    read() {
        return this.content.toString('utf8');
    }
    readAsString(encoding = 'utf8') {
        return this.content.toString(encoding);
    }
    readAsBuffer() {
        return this.content;
    }
    size() {
        return this.content.length;
    }
}
exports.MemFile = MemFile;
class MemDirectory extends MemNode {
    constructor(name, parent = null) {
        super(name, parent);
        this.children = new Map();
    }
    addChild(node) {
        this.children.set(node.name, node);
        node.parent = this;
        this.modifiedAt = new Date();
    }
    removeChild(name) {
        const removed = this.children.delete(name);
        if (removed) {
            this.modifiedAt = new Date();
        }
        return removed;
    }
    getChild(name) {
        return this.children.get(name);
    }
    hasChild(name) {
        return this.children.has(name);
    }
    listChildren() {
        return Array.from(this.children.values());
    }
}
exports.MemDirectory = MemDirectory;
class MemFS {
    constructor() {
        _MemFS_instances.add(this);
        this.root = new MemDirectory('');
        this.cwd = this.root;
    }
    resolvePath(pathStr, startNode) {
        if (!pathStr || pathStr === '/') {
            return this.root;
        }
        const isAbsolute = pathStr.startsWith('/');
        const parts = pathStr.split('/').filter((p) => p && p !== '.');
        let current = isAbsolute
            ? this.root
            : __classPrivateFieldGet(this, _MemFS_instances, "m", _MemFS_normalizeStartNode).call(this, startNode) ?? this.cwd;
        for (const part of parts) {
            if (part === '..') {
                current = current.parent ?? current;
                continue;
            }
            if (!current.isDirectory()) {
                return null;
            }
            const child = current.getChild(part);
            if (!child) {
                return null;
            }
            current = child;
        }
        return current;
    }
    parsePath(pathStr) {
        if (!pathStr || pathStr === '/') {
            return { dir: this.root, name: '' };
        }
        const isAbsolute = pathStr.startsWith('/');
        const parts = pathStr.split('/').filter((p) => p && p !== '.');
        const name = parts.pop();
        if (!name) {
            return null;
        }
        let current = isAbsolute ? this.root : this.cwd;
        for (const part of parts) {
            if (part === '..') {
                current = current.parent ?? current;
            }
            else {
                if (!current.isDirectory()) {
                    return null;
                }
                const child = current.getChild(part);
                if (!child || !child.isDirectory()) {
                    return null;
                }
                current = child;
            }
        }
        if (!current.isDirectory()) {
            return null;
        }
        return { dir: current, name };
    }
    createFile(pathStr, content = '') {
        const parsed = this.parsePath(pathStr);
        if (!parsed) {
            throw new Error(`Cannot create file: invalid path ${pathStr}`);
        }
        const { dir, name } = parsed;
        if (!name) {
            throw new Error('Cannot create file: invalid filename');
        }
        if (dir.hasChild(name)) {
            throw new Error(`File or directory already exists: ${name}`);
        }
        const file = new MemFile(name, content, dir);
        dir.addChild(file);
        return file;
    }
    createDirectory(pathStr) {
        const parsed = this.parsePath(pathStr);
        if (!parsed) {
            throw new Error(`Cannot create directory: invalid path ${pathStr}`);
        }
        const { dir, name } = parsed;
        if (!name) {
            throw new Error('Cannot create directory: invalid name');
        }
        if (dir.hasChild(name)) {
            throw new Error(`File or directory already exists: ${name}`);
        }
        const newDir = new MemDirectory(name, dir);
        dir.addChild(newDir);
        return newDir;
    }
    createDirectories(pathStr) {
        const isAbsolute = pathStr.startsWith('/');
        const parts = pathStr.split('/').filter((p) => p && p !== '.');
        let current = isAbsolute ? this.root : this.cwd;
        for (const part of parts) {
            if (part === '..') {
                current = current.parent ?? current;
            }
            else {
                let child = current.getChild(part);
                if (!child) {
                    child = new MemDirectory(part, current);
                    current.addChild(child);
                }
                else if (!child.isDirectory()) {
                    throw new Error(`Not a directory: ${part}`);
                }
                current = child;
            }
        }
        return current;
    }
    remove(pathStr, recursive = false) {
        const node = this.resolvePath(pathStr);
        if (!node) {
            throw new Error(`No such file or directory: ${pathStr}`);
        }
        if (node === this.root) {
            throw new Error('Cannot remove root directory');
        }
        if (node.isDirectory() && node.children.size > 0 && !recursive) {
            throw new Error(`Directory not empty: ${pathStr}`);
        }
        if (!node.parent) {
            throw new Error('Cannot remove node without parent');
        }
        return node.parent.removeChild(node.name);
    }
    changeDirectory(pathStr) {
        if (!pathStr) {
            this.cwd = this.root;
            return;
        }
        const node = this.resolvePath(pathStr);
        if (!node) {
            throw new Error(`No such directory: ${pathStr}`);
        }
        if (!node.isDirectory()) {
            throw new Error(`Not a directory: ${pathStr}`);
        }
        this.cwd = node;
    }
    getCurrentDirectory() {
        return this.cwd.getPath();
    }
    importFile(realPath, memPath = null) {
        const content = fs.readFileSync(realPath, 'utf8');
        const fileName = memPath ?? path.basename(realPath);
        // Check if file already exists
        const existingFile = this.resolvePath(fileName);
        if (existingFile && existingFile.isFile()) {
            // Update existing file
            existingFile.write(content);
            return existingFile;
        }
        else {
            // Create new file
            return this.createFile(fileName, content);
        }
    }
    exportFile(memPath, realPath) {
        const node = this.resolvePath(memPath);
        if (!node) {
            throw new Error(`No such file: ${memPath}`);
        }
        if (!node.isFile()) {
            throw new Error(`Not a file: ${memPath}`);
        }
        fs.writeFileSync(realPath, node.read(), 'utf8');
    }
    importDirectory(realPath, memPath = null) {
        const stats = fs.statSync(realPath);
        if (!stats.isDirectory()) {
            throw new Error(`Not a directory: ${realPath}`);
        }
        const dirName = memPath ?? path.basename(realPath);
        const memDir = this.createDirectory(dirName);
        const oldCwd = this.cwd;
        this.cwd = memDir;
        const entries = fs.readdirSync(realPath, { withFileTypes: true });
        for (const entry of entries) {
            const entryRealPath = path.join(realPath, entry.name);
            if (entry.isFile()) {
                this.importFile(entryRealPath, entry.name);
            }
            else if (entry.isDirectory()) {
                this.importDirectory(entryRealPath, entry.name);
            }
        }
        this.cwd = oldCwd;
        return memDir;
    }
    exportDirectory(memPath, realPath) {
        const node = this.resolvePath(memPath);
        if (!node) {
            throw new Error(`No such directory: ${memPath}`);
        }
        if (!node.isDirectory()) {
            throw new Error(`Not a directory: ${memPath}`);
        }
        if (!fs.existsSync(realPath)) {
            fs.mkdirSync(realPath, { recursive: true });
        }
        for (const child of node.listChildren()) {
            const childRealPath = path.join(realPath, child.name);
            if (child.isFile()) {
                fs.writeFileSync(childRealPath, child.read(), 'utf8');
            }
            else if (child.isDirectory()) {
                this.exportDirectory(child.getPath(), childRealPath);
            }
        }
    }
    clone(realPath) {
        if (!realPath) {
            throw new Error('Target path is required');
        }
        if (!fs.existsSync(realPath)) {
            fs.mkdirSync(realPath, { recursive: true });
        }
        for (const child of this.root.listChildren()) {
            const childRealPath = path.join(realPath, child.name);
            if (child.isFile()) {
                fs.writeFileSync(childRealPath, child.read(), 'utf8');
            }
            else if (child.isDirectory()) {
                this.exportDirectory(child.getPath(), childRealPath);
            }
        }
    }
    seed(sourcePath) {
        if (!sourcePath) {
            throw new Error('Source path is required');
        }
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source does not exist: ${sourcePath}`);
        }
        const stats = fs.statSync(sourcePath);
        if (stats.isDirectory()) {
            __classPrivateFieldGet(this, _MemFS_instances, "m", _MemFS_seedFromDirectory).call(this, sourcePath);
        }
        else if (stats.isFile()) {
            const ext = path.extname(sourcePath).toLowerCase();
            const basename = path.basename(sourcePath, ext);
            const secondExt = path.extname(basename).toLowerCase();
            if (ext === '.tar' || (secondExt === '.tar' && ext === '.gz')) {
                __classPrivateFieldGet(this, _MemFS_instances, "m", _MemFS_seedFromTar).call(this, sourcePath);
            }
            else {
                throw new Error('Unsupported file type. Only .tar and .tar.gz files are supported.');
            }
        }
        else {
            throw new Error('Source must be a directory or a tar/tar.gz file');
        }
    }
}
exports.MemFS = MemFS;
_MemFS_instances = new WeakSet(), _MemFS_normalizeStartNode = function _MemFS_normalizeStartNode(startNode) {
    if (!startNode) {
        return null;
    }
    if (startNode.isDirectory()) {
        return startNode;
    }
    return startNode.parent ?? null;
}, _MemFS_seedFromDirectory = function _MemFS_seedFromDirectory(dirPath, parent = this.root) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
            const content = fs.readFileSync(entryPath, 'utf8');
            const file = new MemFile(entry.name, content, parent);
            parent.addChild(file);
        }
        else if (entry.isDirectory()) {
            const dir = new MemDirectory(entry.name, parent);
            parent.addChild(dir);
            __classPrivateFieldGet(this, _MemFS_instances, "m", _MemFS_seedFromDirectory).call(this, entryPath, dir);
        }
    }
}, _MemFS_seedFromTar = function _MemFS_seedFromTar(tarPath) {
    let tar;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        tar = require('tar');
    }
    catch (error) {
        throw new Error('tar package is required for tar/tar.gz support. Install it with: npm install tar');
    }
    const entries = [];
    const fileContents = new Map();
    tar.t({
        file: tarPath,
        sync: true,
        onentry: (entry) => {
            entries.push({
                path: entry.path,
                type: entry.type,
                size: entry.size,
            });
        },
    });
    tar.x({
        file: tarPath,
        sync: true,
        cwd: '/tmp',
        onentry: (entry) => {
            if (entry.type === 'File') {
                const chunks = [];
                entry.on('data', (chunk) => chunks.push(chunk));
                entry.on('end', () => {
                    fileContents.set(entry.path, Buffer.concat(chunks).toString('utf8'));
                });
            }
        },
    });
    for (const entry of entries) {
        const entryPath = entry.path;
        const parts = entryPath.split('/').filter((p) => p);
        if (entry.type === 'Directory') {
            let current = this.root;
            for (const part of parts) {
                let child = current.getChild(part);
                if (!child) {
                    child = new MemDirectory(part, current);
                    current.addChild(child);
                }
                if (!child.isDirectory()) {
                    throw new Error(`Unexpected file while creating directory: ${entryPath}`);
                }
                current = child;
            }
        }
        else if (entry.type === 'File') {
            const fileName = parts.pop();
            if (!fileName) {
                continue;
            }
            let current = this.root;
            for (const part of parts) {
                let child = current.getChild(part);
                if (!child) {
                    child = new MemDirectory(part, current);
                    current.addChild(child);
                }
                if (!child.isDirectory()) {
                    throw new Error(`Unexpected file in path: ${entryPath}`);
                }
                current = child;
            }
            const content = fileContents.get(entryPath) ?? '';
            const file = new MemFile(fileName, content, current);
            current.addChild(file);
        }
    }
};
