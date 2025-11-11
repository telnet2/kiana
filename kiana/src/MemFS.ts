import * as fs from 'fs';
import * as path from 'path';

export type MemNodeType = 'file' | 'directory';

export abstract class MemNode {
    public name: string;
    public parent: MemDirectory | null;
    public createdAt: Date;
    public modifiedAt: Date;

    protected constructor(name: string, parent: MemDirectory | null = null) {
        this.name = name;
        this.parent = parent;
        this.createdAt = new Date();
        this.modifiedAt = new Date();
    }

    getPath(): string {
        if (!this.parent) {
            return '/';
        }
        const parentPath = this.parent.getPath();
        return parentPath === '/' ? `/${this.name}` : `${parentPath}/${this.name}`;
    }

    isFile(): this is MemFile {
        return this instanceof MemFile;
    }

    isDirectory(): this is MemDirectory {
        return this instanceof MemDirectory;
    }
}

export class MemFile extends MemNode {
    private content: string;

    constructor(name: string, content = '', parent: MemDirectory | null = null) {
        super(name, parent);
        this.content = content;
    }

    write(content: string): void {
        this.content = content;
        this.modifiedAt = new Date();
    }

    append(content: string): void {
        this.content += content;
        this.modifiedAt = new Date();
    }

    read(): string {
        return this.content;
    }

    size(): number {
        return Buffer.byteLength(this.content, 'utf8');
    }
}

export class MemDirectory extends MemNode {
    public children: Map<string, MemNode>;

    constructor(name: string, parent: MemDirectory | null = null) {
        super(name, parent);
        this.children = new Map<string, MemNode>();
    }

    addChild(node: MemNode): void {
        this.children.set(node.name, node);
        node.parent = this;
        this.modifiedAt = new Date();
    }

    removeChild(name: string): boolean {
        const removed = this.children.delete(name);
        if (removed) {
            this.modifiedAt = new Date();
        }
        return removed;
    }

    getChild(name: string): MemNode | undefined {
        return this.children.get(name);
    }

    hasChild(name: string): boolean {
        return this.children.has(name);
    }

    listChildren(): MemNode[] {
        return Array.from(this.children.values());
    }
}

interface ParsedPath {
    dir: MemDirectory;
    name: string;
}

interface TarEntry {
    path: string;
    type: string;
    size: number;
}

export class MemFS {
    public readonly root: MemDirectory;
    private cwd: MemDirectory;

    constructor() {
        this.root = new MemDirectory('');
        this.cwd = this.root;
    }

    resolvePath(pathStr: string, startNode?: MemNode | null): MemNode | null {
        if (!pathStr || pathStr === '/') {
            return this.root;
        }

        const isAbsolute = pathStr.startsWith('/');
        const parts = pathStr.split('/').filter((p) => p && p !== '.');
        let current: MemNode = isAbsolute
            ? this.root
            : this.#normalizeStartNode(startNode) ?? this.cwd;

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

    parsePath(pathStr: string): ParsedPath | null {
        if (!pathStr || pathStr === '/') {
            return { dir: this.root, name: '' };
        }

        const isAbsolute = pathStr.startsWith('/');
        const parts = pathStr.split('/').filter((p) => p && p !== '.');
        const name = parts.pop();

        if (!name) {
            return null;
        }

        let current: MemNode = isAbsolute ? this.root : this.cwd;
        for (const part of parts) {
            if (part === '..') {
                current = current.parent ?? current;
            } else {
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

    createFile(pathStr: string, content = ''): MemFile {
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

    createDirectory(pathStr: string): MemDirectory {
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

    createDirectories(pathStr: string): MemDirectory {
        const isAbsolute = pathStr.startsWith('/');
        const parts = pathStr.split('/').filter((p) => p && p !== '.');
        let current: MemDirectory = isAbsolute ? this.root : this.cwd;

        for (const part of parts) {
            if (part === '..') {
                current = current.parent ?? current;
            } else {
                let child = current.getChild(part);
                if (!child) {
                    child = new MemDirectory(part, current);
                    current.addChild(child);
                } else if (!child.isDirectory()) {
                    throw new Error(`Not a directory: ${part}`);
                }
                current = child as MemDirectory;
            }
        }

        return current;
    }

    remove(pathStr: string, recursive = false): boolean {
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

    changeDirectory(pathStr?: string): void {
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

    getCurrentDirectory(): string {
        return this.cwd.getPath();
    }

    importFile(realPath: string, memPath: string | null = null): MemFile {
        const content = fs.readFileSync(realPath, 'utf8');
        const fileName = memPath ?? path.basename(realPath);
        
        // Check if file already exists
        const existingFile = this.resolvePath(fileName);
        if (existingFile && existingFile.isFile()) {
            // Update existing file
            existingFile.write(content);
            return existingFile;
        } else {
            // Create new file
            return this.createFile(fileName, content);
        }
    }

    exportFile(memPath: string, realPath: string): void {
        const node = this.resolvePath(memPath);
        if (!node) {
            throw new Error(`No such file: ${memPath}`);
        }

        if (!node.isFile()) {
            throw new Error(`Not a file: ${memPath}`);
        }

        fs.writeFileSync(realPath, node.read(), 'utf8');
    }

    importDirectory(realPath: string, memPath: string | null = null): MemDirectory {
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
            } else if (entry.isDirectory()) {
                this.importDirectory(entryRealPath, entry.name);
            }
        }

        this.cwd = oldCwd;
        return memDir;
    }

    exportDirectory(memPath: string, realPath: string): void {
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
            } else if (child.isDirectory()) {
                this.exportDirectory(child.getPath(), childRealPath);
            }
        }
    }

    clone(realPath: string): void {
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
            } else if (child.isDirectory()) {
                this.exportDirectory(child.getPath(), childRealPath);
            }
        }
    }

    seed(sourcePath: string): void {
        if (!sourcePath) {
            throw new Error('Source path is required');
        }

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source does not exist: ${sourcePath}`);
        }

        const stats = fs.statSync(sourcePath);
        if (stats.isDirectory()) {
            this.#seedFromDirectory(sourcePath);
        } else if (stats.isFile()) {
            const ext = path.extname(sourcePath).toLowerCase();
            const basename = path.basename(sourcePath, ext);
            const secondExt = path.extname(basename).toLowerCase();

            if (ext === '.tar' || (secondExt === '.tar' && ext === '.gz')) {
                this.#seedFromTar(sourcePath);
            } else {
                throw new Error('Unsupported file type. Only .tar and .tar.gz files are supported.');
            }
        } else {
            throw new Error('Source must be a directory or a tar/tar.gz file');
        }
    }

    #normalizeStartNode(startNode?: MemNode | null): MemDirectory | null {
        if (!startNode) {
            return null;
        }
        if (startNode.isDirectory()) {
            return startNode;
        }
        return startNode.parent ?? null;
    }

    #seedFromDirectory(dirPath: string, parent: MemDirectory = this.root): void {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);

            if (entry.isFile()) {
                const content = fs.readFileSync(entryPath, 'utf8');
                const file = new MemFile(entry.name, content, parent);
                parent.addChild(file);
            } else if (entry.isDirectory()) {
                const dir = new MemDirectory(entry.name, parent);
                parent.addChild(dir);
                this.#seedFromDirectory(entryPath, dir);
            }
        }
    }

    #seedFromTar(tarPath: string): void {
        let tar: typeof import('tar');
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            tar = require('tar');
        } catch (error) {
            throw new Error(
                'tar package is required for tar/tar.gz support. Install it with: npm install tar',
            );
        }

        const entries: TarEntry[] = [];
        const fileContents = new Map<string, string>();

        tar.t({
            file: tarPath,
            sync: true,
            onentry: (entry: import('tar').ReadEntry) => {
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
            onentry: (entry: import('tar').ReadEntry) => {
                 if (entry.type === 'File') {
                     const chunks: Buffer[] = [];
                     entry.on('data', (chunk: Buffer) => chunks.push(chunk));
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
                let current: MemDirectory = this.root;
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
            } else if (entry.type === 'File') {
                const fileName = parts.pop();
                if (!fileName) {
                    continue;
                }
                let current: MemDirectory = this.root;

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
    }
}
