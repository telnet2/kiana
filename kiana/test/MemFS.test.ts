import { expect } from 'chai';
import { MemFS, MemFile, MemDirectory } from '../src/MemFS';
import * as realFs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MemFS - In-Memory File System', () => {
    let fs: MemFS;

    beforeEach(() => {
        fs = new MemFS();
    });

    describe('File Operations', () => {
        it('should create a file', () => {
            const file = fs.createFile('test.txt', 'Hello World');
            expect(file).to.be.instanceOf(MemFile);
            expect(file.name).to.equal('test.txt');
            expect(file.read()).to.equal('Hello World');
        });

        it('should read a file', () => {
            fs.createFile('test.txt', 'content');
            const node = fs.resolvePath('test.txt');
            expect(node).to.not.be.null;
            expect(node!.isFile()).to.be.true;
            expect((node as MemFile).read()).to.equal('content');
        });

        it('should write to a file', () => {
            const file = fs.createFile('test.txt', 'initial');
            file.write('updated');
            expect(file.read()).to.equal('updated');
        });

        it('should append to a file', () => {
            const file = fs.createFile('test.txt', 'Hello');
            file.append(' World');
            expect(file.read()).to.equal('Hello World');
        });

        it('should get file size', () => {
            const file = fs.createFile('test.txt', 'Hello');
            expect(file.size()).to.equal(5);
        });

        it('should throw error when creating duplicate file', () => {
            fs.createFile('test.txt', 'content');
            expect(() => fs.createFile('test.txt', 'content')).to.throw();
        });
    });

    describe('Directory Operations', () => {
        it('should create a directory', () => {
            const dir = fs.createDirectory('testdir');
            expect(dir).to.be.instanceOf(MemDirectory);
            expect(dir.name).to.equal('testdir');
        });

        it('should create nested directories with -p flag', () => {
            const dir = fs.createDirectories('a/b/c');
            expect(dir.name).to.equal('c');
            const pathC = fs.resolvePath('a/b/c');
            expect(pathC).to.equal(dir);
        });

        it('should list directory children', () => {
            fs.createDirectory('dir1');
            fs.createFile('file1.txt', '');
            const children = fs.root.listChildren();
            expect(children.length).to.equal(2);
        });

        it('should change directory', () => {
            fs.createDirectory('testdir');
            fs.changeDirectory('testdir');
            expect(fs.getCurrentDirectory()).to.equal('/testdir');
        });

        it('should navigate with .. (parent directory)', () => {
            fs.createDirectories('a/b/c');
            fs.changeDirectory('a/b/c');
            fs.changeDirectory('..');
            expect(fs.getCurrentDirectory()).to.equal('/a/b');
        });

        it('should handle absolute paths', () => {
            fs.createDirectories('a/b');
            fs.changeDirectory('a/b');
            const root = fs.resolvePath('/');
            expect(root).to.equal(fs.root);
        });
    });

    describe('Path Resolution', () => {
        it('should resolve relative path', () => {
            fs.createDirectory('dir');
            const node = fs.resolvePath('dir');
            expect(node?.name).to.equal('dir');
        });

        it('should resolve absolute path', () => {
            fs.createDirectory('dir');
            const node = fs.resolvePath('/dir');
            expect(node?.name).to.equal('dir');
        });

        it('should return null for non-existent path', () => {
            const node = fs.resolvePath('nonexistent');
            expect(node).to.be.null;
        });

        it('should handle complex paths', () => {
            fs.createDirectories('a/b/c');
            fs.createFile('a/b/c/file.txt', 'content');
            const node = fs.resolvePath('a/b/c/file.txt');
            expect(node).to.not.be.null;
            expect(node!.name).to.equal('file.txt');
            expect(node!.isFile()).to.be.true;
            expect((node as MemFile).read()).to.equal('content');
        });
    });

    describe('Remove Operations', () => {
        it('should remove a file', () => {
            fs.createFile('test.txt', 'content');
            fs.remove('test.txt');
            const node = fs.resolvePath('test.txt');
            expect(node).to.be.null;
        });

        it('should remove empty directory', () => {
            fs.createDirectory('emptydir');
            fs.remove('emptydir');
            const node = fs.resolvePath('emptydir');
            expect(node).to.be.null;
        });

        it('should not remove non-empty directory without recursive flag', () => {
            fs.createDirectory('dir');
            fs.createFile('dir/file.txt', '');
            expect(() => fs.remove('dir')).to.throw();
        });

        it('should remove non-empty directory with recursive flag', () => {
            fs.createDirectory('dir');
            fs.createFile('dir/file.txt', '');
            fs.remove('dir', true);
            const node = fs.resolvePath('dir');
            expect(node).to.be.null;
        });

        it('should not remove root directory', () => {
            expect(() => fs.remove('/')).to.throw();
        });
    });

    describe('Node Properties', () => {
        it('should track creation time', () => {
            const file = fs.createFile('test.txt', '');
            expect(file.createdAt).to.be.instanceOf(Date);
        });

        it('should track modification time', (done) => {
            const file = fs.createFile('test.txt', 'initial');
            const initialTime = file.modifiedAt;
            setTimeout(() => {
                file.write('updated');
                expect(file.modifiedAt.getTime()).to.be.greaterThan(initialTime.getTime());
                done();
            }, 10);
        });

        it('should get full path of node', () => {
            fs.createDirectories('a/b');
            fs.createFile('a/b/file.txt', '');
            const node = fs.resolvePath('a/b/file.txt');
            expect(node?.getPath()).to.equal('/a/b/file.txt');
        });

        it('should identify node types', () => {
            const file = fs.createFile('file.txt', '');
            const dir = fs.createDirectory('dir');
            expect(file.isFile()).to.be.true;
            expect(file.isDirectory()).to.be.false;
            expect(dir.isFile()).to.be.false;
            expect(dir.isDirectory()).to.be.true;
        });
    });

    describe('Clone Operations', () => {
        let testDir: string;

        beforeEach(() => {
            // Create a unique temporary directory for each test
            testDir = path.join(os.tmpdir(), `memfs-test-${Date.now()}`);
        });

        afterEach(() => {
            // Clean up the test directory
            if (realFs.existsSync(testDir)) {
                realFs.rmSync(testDir, { recursive: true, force: true });
            }
        });

        it('should clone entire file system to real filesystem', () => {
            // Create a complex file system structure
            fs.createDirectory('dir1');
            fs.createFile('dir1/file1.txt', 'content1');
            fs.createFile('dir1/file2.txt', 'content2');

            fs.createDirectories('dir2/subdir');
            fs.createFile('dir2/file3.txt', 'content3');
            fs.createFile('dir2/subdir/file4.txt', 'content4');

            fs.createFile('root.txt', 'root content');

            // Clone to real filesystem
            fs.clone(testDir);

            // Verify all files and directories exist
            expect(realFs.existsSync(testDir)).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'dir1'))).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'dir1/file1.txt'))).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'dir1/file2.txt'))).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'dir2'))).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'dir2/subdir'))).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'dir2/file3.txt'))).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'dir2/subdir/file4.txt'))).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'root.txt'))).to.be.true;

            // Verify file contents
            expect(realFs.readFileSync(path.join(testDir, 'dir1/file1.txt'), 'utf8')).to.equal('content1');
            expect(realFs.readFileSync(path.join(testDir, 'dir1/file2.txt'), 'utf8')).to.equal('content2');
            expect(realFs.readFileSync(path.join(testDir, 'dir2/file3.txt'), 'utf8')).to.equal('content3');
            expect(realFs.readFileSync(path.join(testDir, 'dir2/subdir/file4.txt'), 'utf8')).to.equal('content4');
            expect(realFs.readFileSync(path.join(testDir, 'root.txt'), 'utf8')).to.equal('root content');
        });

        it('should create target directory if it does not exist', () => {
            fs.createFile('test.txt', 'test content');

            // Clone to non-existent directory
            fs.clone(testDir);

            expect(realFs.existsSync(testDir)).to.be.true;
            expect(realFs.existsSync(path.join(testDir, 'test.txt'))).to.be.true;
            expect(realFs.readFileSync(path.join(testDir, 'test.txt'), 'utf8')).to.equal('test content');
        });

        it('should handle empty file system', () => {
            // Clone empty file system
            fs.clone(testDir);

            // Directory should be created but empty
            expect(realFs.existsSync(testDir)).to.be.true;
            const contents = realFs.readdirSync(testDir);
            expect(contents.length).to.equal(0);
        });

        it('should throw error when target path is not provided', () => {
            expect(() => (fs as any).clone()).to.throw('Target path is required');
        });
    });

    describe('Seed Operations', () => {
        let testDir: string;

        beforeEach(() => {
            // Create a unique temporary directory for each test
            testDir = path.join(os.tmpdir(), `memfs-seed-test-${Date.now()}`);
            realFs.mkdirSync(testDir, { recursive: true });
        });

        afterEach(() => {
            // Clean up the test directory
            if (realFs.existsSync(testDir)) {
                realFs.rmSync(testDir, { recursive: true, force: true });
            }
        });

        it('should seed from a directory', () => {
            // Create a real filesystem structure to seed from
            realFs.mkdirSync(path.join(testDir, 'dir1'));
            realFs.writeFileSync(path.join(testDir, 'dir1/file1.txt'), 'content1', 'utf8');
            realFs.writeFileSync(path.join(testDir, 'dir1/file2.txt'), 'content2', 'utf8');

            realFs.mkdirSync(path.join(testDir, 'dir2/subdir'), { recursive: true });
            realFs.writeFileSync(path.join(testDir, 'dir2/file3.txt'), 'content3', 'utf8');
            realFs.writeFileSync(path.join(testDir, 'dir2/subdir/file4.txt'), 'content4', 'utf8');

            realFs.writeFileSync(path.join(testDir, 'root.txt'), 'root content', 'utf8');

            // Seed the in-memory filesystem
            fs.seed(testDir);

            // Verify all files and directories were imported
            expect(fs.resolvePath('/dir1')).to.not.be.null;
            expect(fs.resolvePath('/dir1/file1.txt')).to.not.be.null;
            expect(fs.resolvePath('/dir1/file2.txt')).to.not.be.null;
            expect(fs.resolvePath('/dir2')).to.not.be.null;
            expect(fs.resolvePath('/dir2/subdir')).to.not.be.null;
            expect(fs.resolvePath('/dir2/file3.txt')).to.not.be.null;
            expect(fs.resolvePath('/dir2/subdir/file4.txt')).to.not.be.null;
            expect(fs.resolvePath('/root.txt')).to.not.be.null;

            // Verify file contents
            const file1 = fs.resolvePath('/dir1/file1.txt');
            const file2 = fs.resolvePath('/dir1/file2.txt');
            const file3 = fs.resolvePath('/dir2/file3.txt');
            const file4 = fs.resolvePath('/dir2/subdir/file4.txt');
            const rootFile = fs.resolvePath('/root.txt');
            
            expect(file1).to.not.be.null;
            expect(file2).to.not.be.null;
            expect(file3).to.not.be.null;
            expect(file4).to.not.be.null;
            expect(rootFile).to.not.be.null;
            
            expect((file1 as MemFile).read()).to.equal('content1');
            expect((file2 as MemFile).read()).to.equal('content2');
            expect((file3 as MemFile).read()).to.equal('content3');
            expect((file4 as MemFile).read()).to.equal('content4');
            expect((rootFile as MemFile).read()).to.equal('root content');
        });

        it('should handle empty directory when seeding', () => {
            // Seed from empty directory
            fs.seed(testDir);

            // File system should remain empty
            const children = fs.root.listChildren();
            expect(children.length).to.equal(0);
        });

        it('should throw error when source path does not exist', () => {
            const nonExistentPath = path.join(testDir, 'nonexistent');
            expect(() => fs.seed(nonExistentPath)).to.throw('Source does not exist');
        });

        it('should throw error when source path is not provided', () => {
            expect(() => (fs as any).seed()).to.throw('Source path is required');
        });

        it('should seed and then clone successfully (round-trip test)', () => {
            // Create source directory structure
            realFs.mkdirSync(path.join(testDir, 'source'));
            realFs.mkdirSync(path.join(testDir, 'source/dir1'));
            realFs.writeFileSync(path.join(testDir, 'source/dir1/file1.txt'), 'test content', 'utf8');
            realFs.writeFileSync(path.join(testDir, 'source/root.txt'), 'root', 'utf8');

            // Seed from source
            fs.seed(path.join(testDir, 'source'));

            // Clone to destination
            const destDir = path.join(testDir, 'dest');
            fs.clone(destDir);

            // Verify destination has same structure
            expect(realFs.existsSync(path.join(destDir, 'dir1/file1.txt'))).to.be.true;
            expect(realFs.existsSync(path.join(destDir, 'root.txt'))).to.be.true;
            expect(realFs.readFileSync(path.join(destDir, 'dir1/file1.txt'), 'utf8')).to.equal('test content');
            expect(realFs.readFileSync(path.join(destDir, 'root.txt'), 'utf8')).to.equal('root');
        });

        it('should throw error for unsupported file types', () => {
            const testFile = path.join(testDir, 'test.zip');
            realFs.writeFileSync(testFile, 'dummy content', 'utf8');

            expect(() => fs.seed(testFile)).to.throw('Unsupported file type');
        });
    });
});