/**
 * VFSMemFS2 Integration Tests
 * Tests VFSMemFS2 against real VFS server at http://localhost:18080
 *
 * Key improvements over original tests:
 * - No hardcoded timeouts - uses proper async/await
 * - Tests error cases explicitly
 * - Tests binary data properly
 * - Tests concurrent operations
 */

import { expect } from 'chai';
import {
  VFSMemFS2,
  VFSClient2,
  VFSMemFS2Options,
  VFSMemFS2Statistics,
  VFSMemFS2Error,
  MemFile2,
  MemDirectory2
} from '../src/VFSMemFS2';

describe('VFSMemFS2 Integration with Real VFS Server', function() {
  this.timeout(30000); // 30 second timeout for all tests

  let vfsMemFS: VFSMemFS2;
  let vfs: VFSClient2;
  let testDirectory: string;

  before(async function() {
    try {
      if (!process.env.VFS_AUTH_TOKEN) {
        throw new Error('VFS_AUTH_TOKEN environment variable is not set');
      }

      // Dynamically import VFS to handle ESM module
      const vfsModule = await import('@byted/crystal-vfs');
      const VFSClass = vfsModule.VFS;
      console.log('✅ VFS module loaded successfully');

      // Initialize real VFS client with VFS_AUTH_TOKEN token
      vfs = new VFSClass({
        baseURL: 'http://localhost:18080',
        token: process.env.VFS_AUTH_TOKEN
      });

      // Verify connection
      try {
        await vfs.stat('/');
        console.log('✅ Connected to VFS server at http://localhost:18080');
      } catch (error: any) {
        console.error('❌ Failed to connect to VFS server:', error.message);
        throw new Error('VFS server not available. Please ensure it is running at http://localhost:18080');
      }
    } catch (error: any) {
      console.error('❌ Failed to load VFS module:', error.message);
      throw error;
    }
  });

  beforeEach(function() {
    // Generate unique test directory for each test
    const randomNum = Math.floor(Math.random() * 1000000);
    testDirectory = `/temp/vfsmemfs2-test-${randomNum}`;
  });

  afterEach(async function() {
    // Clean up test directory
    try {
      await vfs.rm(testDirectory, { recursive: true });
      console.log(`🧹 Cleaned up: ${testDirectory}`);
    } catch (error: any) {
      // Ignore if directory doesn't exist
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️ Cleanup failed: ${error.message}`);
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize VFSMemFS2 with correct options', () => {
      const options: VFSMemFS2Options = {
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync',
        cacheOnRead: true
      };

      vfsMemFS = new VFSMemFS2(options);

      expect(vfsMemFS).to.exist;
      expect(vfsMemFS.getWriteMode()).to.equal('sync');
      expect(vfsMemFS.getBaseDirectory()).to.equal(testDirectory);

      const stats = vfsMemFS.getStatistics();
      expect(stats.dirtyFiles).to.equal(0);
      expect(stats.deletedFiles).to.equal(0);
      expect(stats.totalFiles).to.equal(0);
      expect(stats.syncInProgress).to.be.false;
    });

    it('should verify connection to VFS server through file operations', async () => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });

      // Create a file - this should sync to VFS
      await vfsMemFS.createFile('/connection-test.txt', 'test content');

      // Verify on real VFS
      const vfsContent = await vfs.readFile(`${testDirectory}/connection-test.txt`, 'utf8');
      expect(vfsContent).to.equal('test content');
      console.log('✅ VFSMemFS2 connection verified');
    });
  });

  describe('Sync Mode - File Operations', () => {
    beforeEach(() => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });
    });

    it('should create and sync file immediately', async () => {
      const content = `Sync test - ${Date.now()}`;
      const file = await vfsMemFS.createFile('/sync-file.txt', content);

      expect(file).to.be.instanceOf(MemFile2);
      expect(file.readAsString()).to.equal(content);

      // Verify on VFS - no delay needed!
      const vfsContent = await vfs.readFile(`${testDirectory}/sync-file.txt`, 'utf8');
      expect(vfsContent).to.equal(content);

      // Stats should show 0 dirty files in sync mode
      const stats = vfsMemFS.getStatistics();
      expect(stats.dirtyFiles).to.equal(0);
      expect(stats.totalFiles).to.equal(1);
    });

    it('should update existing file and sync', async () => {
      const initial = 'initial content';
      const updated = 'updated content';

      await vfsMemFS.createFile('/update-test.txt', initial);
      await vfsMemFS.writeFile('/update-test.txt', updated);

      // Verify updated content on VFS
      const vfsContent = await vfs.readFile(`${testDirectory}/update-test.txt`, 'utf8');
      expect(vfsContent).to.equal(updated);

      // Verify in memory
      const memContent = vfsMemFS.readFile('/update-test.txt', 'utf8');
      expect(memContent).to.equal(updated);
    });

    it('should append to file and sync', async () => {
      await vfsMemFS.createFile('/append-test.txt', 'Hello');
      await vfsMemFS.appendFile('/append-test.txt', ' World');

      const vfsContent = await vfs.readFile(`${testDirectory}/append-test.txt`, 'utf8');
      expect(vfsContent).to.equal('Hello World');
    });

    it('should delete file and sync to VFS', async () => {
      await vfsMemFS.createFile('/delete-me.txt', 'to be deleted');

      // Verify file exists on VFS
      const stat = await vfs.stat(`${testDirectory}/delete-me.txt`);
      expect(stat.isFile()).to.be.true;

      // Delete through VFSMemFS2
      await vfsMemFS.remove('/delete-me.txt');

      // Verify deleted from VFS
      try {
        await vfs.readFile(`${testDirectory}/delete-me.txt`);
        throw new Error('File should not exist');
      } catch (error: any) {
        expect(error.code).to.equal('ENOENT');
      }

      // Verify deleted from memory
      expect(vfsMemFS.resolvePath('/delete-me.txt')).to.be.null;
    });

    it('should handle binary data correctly', async () => {
      // Create binary data
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);

      await vfsMemFS.createFile('/binary.bin', binaryData);

      // Read from memory
      const memBuffer = vfsMemFS.readFile('/binary.bin') as Buffer;
      expect(Buffer.isBuffer(memBuffer)).to.be.true;
      expect(memBuffer.equals(binaryData)).to.be.true;

      // Verify on VFS (will be base64 encoded internally)
      const vfsData = await vfs.readFile(`${testDirectory}/binary.bin`);
      expect(vfsData).to.be.instanceOf(Uint8Array);
      expect(Buffer.from(vfsData as Uint8Array).equals(binaryData)).to.be.true;
    });

    it('should handle UTF-8 text with special characters', async () => {
      const content = '你好世界 🌍 مرحبا العالم';

      await vfsMemFS.createFile('/unicode.txt', content);

      const vfsContent = await vfs.readFile(`${testDirectory}/unicode.txt`, 'utf8');
      expect(vfsContent).to.equal(content);
    });
  });

  describe('Sync Mode - Directory Operations', () => {
    beforeEach(() => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });
    });

    it('should create directory and sync', async () => {
      const dir = await vfsMemFS.createDirectory('/my-dir');

      expect(dir).to.be.instanceOf(MemDirectory2);

      // Verify on VFS
      const stat = await vfs.stat(`${testDirectory}/my-dir`);
      expect(stat.isDirectory()).to.be.true;
    });

    it('should create nested directories', async () => {
      const deepDir = await vfsMemFS.createDirectories('/a/b/c/d');

      expect(deepDir.name).to.equal('d');

      // Verify each level on VFS
      for (const path of ['/a', '/a/b', '/a/b/c', '/a/b/c/d']) {
        const stat = await vfs.stat(`${testDirectory}${path}`);
        expect(stat.isDirectory()).to.be.true;
      }
    });

    it('should create files in nested directories', async () => {
      await vfsMemFS.createDirectories('/nested/path');
      await vfsMemFS.createFile('/nested/path/file.txt', 'nested content');

      const content = await vfs.readFile(`${testDirectory}/nested/path/file.txt`, 'utf8');
      expect(content).to.equal('nested content');
    });

    it('should delete directory recursively', async () => {
      await vfsMemFS.createDirectories('/to-delete/sub');
      await vfsMemFS.createFile('/to-delete/file1.txt', 'file1');
      await vfsMemFS.createFile('/to-delete/sub/file2.txt', 'file2');

      // Delete recursively
      await vfsMemFS.remove('/to-delete', true);

      // Verify deleted from VFS
      try {
        await vfs.stat(`${testDirectory}/to-delete`);
        throw new Error('Directory should not exist');
      } catch (error: any) {
        expect(error.code).to.equal('ENOENT');
      }
    });

    it('should list directory contents', async () => {
      await vfsMemFS.createDirectory('/list-test');
      await vfsMemFS.createFile('/list-test/file1.txt', 'a');
      await vfsMemFS.createFile('/list-test/file2.txt', 'b');
      await vfsMemFS.createDirectory('/list-test/subdir');

      const contents = vfsMemFS.listDirectory('/list-test');

      expect(contents).to.have.length(3);
      const names = contents.map(n => n.name).sort();
      expect(names).to.deep.equal(['file1.txt', 'file2.txt', 'subdir']);
    });
  });

  describe('Flush Mode', () => {
    let flushVFS: VFSMemFS2;

    beforeEach(() => {
      flushVFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'flush'
      });
    });

    it('should buffer writes and not sync until flush', async () => {
      await flushVFS.createFile('/buffered.txt', 'buffered content');

      // Stats should show dirty file
      let stats = flushVFS.getStatistics();
      expect(stats.dirtyFiles).to.equal(1);

      // File should NOT be on VFS yet
      try {
        await vfs.readFile(`${testDirectory}/buffered.txt`);
        throw new Error('File should not exist on VFS before flush');
      } catch (error: any) {
        expect(error.code).to.equal('ENOENT');
      }

      // Flush to VFS
      await flushVFS.flush();

      // Now file should be on VFS
      const content = await vfs.readFile(`${testDirectory}/buffered.txt`, 'utf8');
      expect(content).to.equal('buffered content');

      // Stats should show no dirty files
      stats = flushVFS.getStatistics();
      expect(stats.dirtyFiles).to.equal(0);
    });

    it('should handle multiple buffered operations', async () => {
      await flushVFS.createDirectories('/batch/sub');
      await flushVFS.createFile('/batch/file1.txt', 'one');
      await flushVFS.createFile('/batch/file2.txt', 'two');
      await flushVFS.createFile('/batch/sub/file3.txt', 'three');

      expect(flushVFS.getStatistics().dirtyFiles).to.be.at.least(3);

      // Flush all
      await flushVFS.flush();

      // Verify all on VFS
      const c1 = await vfs.readFile(`${testDirectory}/batch/file1.txt`, 'utf8');
      const c2 = await vfs.readFile(`${testDirectory}/batch/file2.txt`, 'utf8');
      const c3 = await vfs.readFile(`${testDirectory}/batch/sub/file3.txt`, 'utf8');

      expect(c1).to.equal('one');
      expect(c2).to.equal('two');
      expect(c3).to.equal('three');
    });

    it('should handle deletions in flush mode', async () => {
      // Create and flush first
      await flushVFS.createFile('/to-delete.txt', 'delete me');
      await flushVFS.flush();

      // Now delete
      await flushVFS.remove('/to-delete.txt');

      // File should still exist on VFS
      const stat = await vfs.stat(`${testDirectory}/to-delete.txt`);
      expect(stat.isFile()).to.be.true;

      // Stats should show deleted file
      expect(flushVFS.getStatistics().deletedFiles).to.equal(1);

      // Flush deletions
      await flushVFS.flush();

      // Now file should be gone
      try {
        await vfs.stat(`${testDirectory}/to-delete.txt`);
        throw new Error('File should be deleted');
      } catch (error: any) {
        expect(error.code).to.equal('ENOENT');
      }
    });

    it('should handle updates correctly', async () => {
      await flushVFS.createFile('/update.txt', 'v1');
      await flushVFS.flush();

      // Update multiple times before flushing
      await flushVFS.writeFile('/update.txt', 'v2');
      await flushVFS.writeFile('/update.txt', 'v3');
      await flushVFS.writeFile('/update.txt', 'final');

      // Only final version should be flushed
      await flushVFS.flush();

      const content = await vfs.readFile(`${testDirectory}/update.txt`, 'utf8');
      expect(content).to.equal('final');
    });
  });

  describe('Pre-population', () => {
    it('should pre-populate from existing VFS directory', async () => {
      // First, create files directly on VFS
      await vfs.mkdir(`${testDirectory}/prepop`, { recursive: true });
      await vfs.mkdir(`${testDirectory}/prepop/subdir`, { recursive: true });
      await vfs.writeFileText(`${testDirectory}/prepop/file1.txt`, 'content1');
      await vfs.writeFileText(`${testDirectory}/prepop/subdir/file2.txt`, 'content2');

      // Create VFSMemFS2 and pre-populate
      const prepopVFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: `${testDirectory}/prepop`,
        writeMode: 'sync'
      });

      await prepopVFS.prePopulate();

      // Verify files are in memory
      const file1 = prepopVFS.resolvePath('/file1.txt');
      expect(file1).to.exist;
      expect(file1!.isFile()).to.be.true;
      expect((file1 as MemFile2).readAsString()).to.equal('content1');

      const file2 = prepopVFS.resolvePath('/subdir/file2.txt');
      expect(file2).to.exist;
      expect(file2!.isFile()).to.be.true;
      expect((file2 as MemFile2).readAsString()).to.equal('content2');

      // Verify stats
      const stats = prepopVFS.getStatistics();
      expect(stats.totalFiles).to.equal(2);
      expect(stats.totalDirectories).to.equal(1);
    });

    it('should handle empty VFS directory gracefully', async () => {
      const emptyVFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: `${testDirectory}/nonexistent`,
        writeMode: 'sync'
      });

      // Should not throw
      await emptyVFS.prePopulate();

      const stats = emptyVFS.getStatistics();
      expect(stats.totalFiles).to.equal(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });
    });

    it('should throw error for duplicate file creation', async () => {
      await vfsMemFS.createFile('/duplicate.txt', 'first');

      try {
        await vfsMemFS.createFile('/duplicate.txt', 'second');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(VFSMemFS2Error);
        expect((error as VFSMemFS2Error).code).to.equal('EEXIST');
      }
    });

    it('should throw error for reading non-existent file', () => {
      try {
        vfsMemFS.readFile('/does-not-exist.txt');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(VFSMemFS2Error);
        expect((error as VFSMemFS2Error).code).to.equal('ENOENT');
      }
    });

    it('should throw error for appending to non-existent file', async () => {
      try {
        await vfsMemFS.appendFile('/no-file.txt', 'data');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(VFSMemFS2Error);
        expect((error as VFSMemFS2Error).code).to.equal('ENOENT');
      }
    });

    it('should throw error for removing non-empty directory without recursive', async () => {
      await vfsMemFS.createDirectory('/not-empty');
      await vfsMemFS.createFile('/not-empty/file.txt', 'data');

      try {
        await vfsMemFS.remove('/not-empty');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(VFSMemFS2Error);
        expect((error as VFSMemFS2Error).code).to.equal('ENOTEMPTY');
      }
    });

    it('should throw error for creating file in non-existent directory', async () => {
      try {
        await vfsMemFS.createFile('/no-dir/file.txt', 'data');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(VFSMemFS2Error);
        expect((error as VFSMemFS2Error).code).to.equal('EINVAL');
      }
    });

    it('should throw error when trying to write to a directory path', async () => {
      await vfsMemFS.createDirectory('/is-dir');

      try {
        await vfsMemFS.writeFile('/is-dir', 'data');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(VFSMemFS2Error);
        expect((error as VFSMemFS2Error).code).to.equal('EISDIR');
      }
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });
    });

    it('should track file and directory counts accurately', async () => {
      await vfsMemFS.createDirectory('/stats-dir');
      await vfsMemFS.createFile('/file1.txt', 'a');
      await vfsMemFS.createFile('/file2.txt', 'b');
      await vfsMemFS.createFile('/stats-dir/file3.txt', 'c');

      const stats = vfsMemFS.getStatistics();

      expect(stats.totalFiles).to.equal(3);
      expect(stats.totalDirectories).to.equal(1);
      expect(stats.cachedFiles).to.equal(3); // All synced in sync mode
      expect(stats.dirtyFiles).to.equal(0);
    });

    it('should track dirty files in flush mode', async () => {
      const flushVFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'flush'
      });

      await flushVFS.createFile('/dirty1.txt', 'a');
      await flushVFS.createFile('/dirty2.txt', 'b');

      const stats = flushVFS.getStatistics();
      expect(stats.dirtyFiles).to.equal(2);
      expect(stats.cachedFiles).to.equal(0);

      await flushVFS.flush();

      const statsAfter = flushVFS.getStatistics();
      expect(statsAfter.dirtyFiles).to.equal(0);
      expect(statsAfter.cachedFiles).to.equal(2);
    });

    it('should track lastSyncTime', async () => {
      const before = new Date();
      await vfsMemFS.createFile('/time-test.txt', 'data');
      const after = new Date();

      const stats = vfsMemFS.getStatistics();
      expect(stats.lastSyncTime).to.exist;
      expect(stats.lastSyncTime!.getTime()).to.be.at.least(before.getTime());
      expect(stats.lastSyncTime!.getTime()).to.be.at.most(after.getTime());
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(() => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });
    });

    it('should handle concurrent file creations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(vfsMemFS.createFile(`/concurrent-${i}.txt`, `content-${i}`));
      }

      await Promise.all(promises);

      // Verify all files exist
      const stats = vfsMemFS.getStatistics();
      expect(stats.totalFiles).to.equal(10);

      // Verify on VFS
      for (let i = 0; i < 10; i++) {
        const content = await vfs.readFile(`${testDirectory}/concurrent-${i}.txt`, 'utf8');
        expect(content).to.equal(`content-${i}`);
      }
    });

    it('should handle concurrent operations on different files', async () => {
      await vfsMemFS.createFile('/file-a.txt', 'a');
      await vfsMemFS.createFile('/file-b.txt', 'b');

      // Concurrent updates and appends
      await Promise.all([
        vfsMemFS.writeFile('/file-a.txt', 'updated-a'),
        vfsMemFS.appendFile('/file-b.txt', '-appended')
      ]);

      const contentA = await vfs.readFile(`${testDirectory}/file-a.txt`, 'utf8');
      const contentB = await vfs.readFile(`${testDirectory}/file-b.txt`, 'utf8');

      expect(contentA).to.equal('updated-a');
      expect(contentB).to.equal('b-appended');
    });
  });

  describe('Mode Switching', () => {
    it('should switch from sync to flush mode', async () => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });

      await vfsMemFS.createFile('/before-switch.txt', 'synced');

      // Switch to flush mode
      vfsMemFS.setWriteMode('flush');
      expect(vfsMemFS.getWriteMode()).to.equal('flush');

      await vfsMemFS.createFile('/after-switch.txt', 'buffered');

      // First file should be on VFS
      const c1 = await vfs.readFile(`${testDirectory}/before-switch.txt`, 'utf8');
      expect(c1).to.equal('synced');

      // Second file should NOT be on VFS yet
      try {
        await vfs.readFile(`${testDirectory}/after-switch.txt`);
        throw new Error('Should not exist');
      } catch (error: any) {
        expect(error.code).to.equal('ENOENT');
      }

      // Flush should sync it
      await vfsMemFS.flush();
      const c2 = await vfs.readFile(`${testDirectory}/after-switch.txt`, 'utf8');
      expect(c2).to.equal('buffered');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      vfsMemFS = new VFSMemFS2({
        vfs: vfs,
        baseDirectory: testDirectory,
        writeMode: 'sync'
      });
    });

    it('should handle empty files', async () => {
      await vfsMemFS.createFile('/empty.txt', '');

      const content = await vfs.readFile(`${testDirectory}/empty.txt`, 'utf8');
      expect(content).to.equal('');
    });

    it('should handle files with special characters in name', async () => {
      const filename = '/file-with-special_chars.2024.txt';
      await vfsMemFS.createFile(filename, 'special');

      const content = await vfs.readFile(`${testDirectory}${filename}`, 'utf8');
      expect(content).to.equal('special');
    });

    it('should handle large files', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB

      await vfsMemFS.createFile('/large.txt', largeContent);

      const content = await vfs.readFile(`${testDirectory}/large.txt`, 'utf8');
      expect(content).to.equal(largeContent);
      expect(content.length).to.equal(100000);
    });

    it('should handle deeply nested paths', async () => {
      const deepPath = '/a/b/c/d/e/f/g/h/i/j';
      await vfsMemFS.createDirectories(deepPath);
      await vfsMemFS.createFile(`${deepPath}/file.txt`, 'deep');

      const content = await vfs.readFile(`${testDirectory}${deepPath}/file.txt`, 'utf8');
      expect(content).to.equal('deep');
    });

    it('should handle root directory operations', () => {
      const root = vfsMemFS.resolvePath('/');
      expect(root).to.exist;
      expect(root!.isDirectory()).to.be.true;

      const contents = vfsMemFS.listDirectory('/');
      expect(contents).to.be.an('array');
    });
  });
});
