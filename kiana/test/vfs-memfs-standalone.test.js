/**
 * VFSMemFS Standalone Test - No VFS Server Required
 * Tests VFSMemFS functionality without requiring a real VFS server
 * This demonstrates that VFSMemFS works correctly as an in-memory file system
 */

const { expect } = require('chai');
const { VFSMemFS } = require('../lib/VFSMemFS');

describe('VFSMemFS Standalone Functionality (No VFS Server Required)', function() {
  let vfsMemFS;
  let mockVFS;

  before(function() {
    // Create a mock VFS client that doesn't require a real server
    mockVFS = {
      readFile: async (path, encoding) => {
        console.log(`   Mock VFS: readFile(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      },
      writeFile: async (path, data) => {
        console.log(`   Mock VFS: writeFile(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      },
      writeFileText: async (path, text) => {
        console.log(`   Mock VFS: writeFileText(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      },
      mkdir: async (path, options) => {
        console.log(`   Mock VFS: mkdir(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      },
      readdir: async (path, options) => {
        console.log(`   Mock VFS: readdir(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      },
      stat: async (path) => {
        console.log(`   Mock VFS: stat(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      },
      unlink: async (path) => {
        console.log(`   Mock VFS: unlink(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      },
      rm: async (path, options) => {
        console.log(`   Mock VFS: rm(${path}) - would normally connect to server`);
        throw new Error('Mock VFS - no server available');
      }
    };

    console.log('🚀 Testing VFSMemFS standalone functionality...');
    console.log('ℹ️  Note: VFS server operations will fail, but in-memory operations should work');
  });

  describe('VFSMemFS In-Memory Operations', () => {
    it('should initialize VFSMemFS with mock VFS client', () => {
      vfsMemFS = new VFSMemFS({
        vfs: mockVFS,
        baseDirectory: '/test',
        writeMode: 'sync',
        prePopulate: false,
        cacheOnRead: true
      });

      expect(vfsMemFS).to.exist;
      expect(vfsMemFS.getStatistics).to.be.a('function');
      
      const stats = vfsMemFS.getStatistics();
      expect(stats).to.have.property('dirtyFiles');
      expect(stats).to.have.property('cachedFiles');
      expect(stats).to.have.property('totalFiles');
      expect(stats).to.have.property('syncInProgress');
      expect(stats).to.have.property('lastSyncTime');
      
      console.log('✅ VFSMemFS initialized successfully with mock VFS client');
      console.log(`   Base directory: /test`);
      console.log(`   Write mode: sync`);
      console.log(`   Initial stats:`, stats);
    });

    it('should create and manage files in memory', () => {
      const filePath = '/test-file.txt';
      const content = 'This is a test file content';
      
      // Create file in memory
      vfsMemFS.writeFile(filePath, content);
      console.log(`✅ Created file in memory: ${filePath}`);
      
      // Read file from memory
      const fileNode = vfsMemFS.resolvePath(filePath);
      expect(fileNode).to.exist;
      expect(fileNode.isFile()).to.be.true;
      const readContent = fileNode.read();
      expect(readContent).to.equal(content);
      console.log(`✅ Read file from memory: ${filePath}`);
      console.log(`   Content: ${readContent}`);
      
      // Check statistics
      const stats = vfsMemFS.getStatistics();
      expect(stats.totalFiles).to.be.at.least(1);
      console.log(`   VFSMemFS stats after file operations:`, stats);
    });

    it('should create and manage directories in memory', () => {
      const dirPath = '/test-dir';
      const subDirPath = '/test-dir/subdir';
      
      // Create directories in memory
      vfsMemFS.createDirectory(dirPath);
      vfsMemFS.createDirectory(subDirPath);
      console.log(`✅ Created directories in memory: ${dirPath}, ${subDirPath}`);
      
      // List directory contents
      const dirNode = vfsMemFS.resolvePath(dirPath);
      expect(dirNode).to.exist;
      expect(dirNode.isDirectory()).to.be.true;
      const contents = dirNode.listChildren();
      expect(contents).to.be.an('array');
      expect(contents.length).to.be.at.least(1);
      console.log(`✅ Listed directory contents: ${contents.length} items`);
      
      // Check statistics
      const stats = vfsMemFS.getStatistics();
      expect(stats.totalFiles).to.be.at.least(2); // directory + subdirectory
      console.log(`   VFSMemFS stats after directory operations:`, stats);
    });

    it('should handle nested file operations', () => {
      const nestedPath = '/test-dir/subdir/nested-file.txt';
      const content = 'Nested file content';
      
      // Create nested file
      vfsMemFS.writeFile(nestedPath, content);
      console.log(`✅ Created nested file in memory: ${nestedPath}`);
      
      // Read nested file
      const nestedFileNode = vfsMemFS.resolvePath(nestedPath);
      expect(nestedFileNode).to.exist;
      expect(nestedFileNode.isFile()).to.be.true;
      const readContent = nestedFileNode.read();
      expect(readContent).to.equal(content);
      console.log(`✅ Read nested file from memory: ${nestedPath}`);
      
      // Check statistics
      const stats = vfsMemFS.getStatistics();
      expect(stats.totalFiles).to.be.at.least(3); // parent dirs + file
      console.log(`   VFSMemFS stats after nested operations:`, stats);
    });

    it('should delete files and directories in memory', () => {
      const filePath = '/file-to-delete.txt';
      const content = 'Content to be deleted';
      
      // Create file first
      vfsMemFS.writeFile(filePath, content);
      console.log(`✅ Created file to delete: ${filePath}`);
      
      // Verify file exists
      let fileNode = vfsMemFS.resolvePath(filePath);
      expect(fileNode).to.exist;
      
      // Delete file
      vfsMemFS.remove(filePath);
      console.log(`✅ Deleted file from memory: ${filePath}`);
      
      // Verify file is gone
      fileNode = vfsMemFS.resolvePath(filePath);
      expect(fileNode).to.be.null;
      console.log(`✅ Confirmed file deleted from memory`);
      
      // Check statistics
      const stats = vfsMemFS.getStatistics();
      console.log(`   VFSMemFS stats after deletion:`, stats);
    });

    it('should handle binary data correctly', () => {
      const binaryPath = '/binary-data.bin';
      const binaryData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      
      // Convert binary to string for VFSMemFS (which only handles strings)
      const binaryString = Array.from(binaryData).join(',');
      
      // Write binary data
      vfsMemFS.writeFile(binaryPath, binaryString);
      console.log(`✅ Written binary data to memory: ${binaryPath}`);
      
      // Read binary data
      const binaryFileNode = vfsMemFS.resolvePath(binaryPath);
      expect(binaryFileNode).to.exist;
      expect(binaryFileNode.isFile()).to.be.true;
      const readBinaryData = binaryFileNode.read();
      expect(readBinaryData).to.equal(binaryString);
      console.log(`✅ Read binary data from memory: ${binaryPath}`);
      console.log(`   Binary data: ${readBinaryData}`);
    });

    it('should provide accurate statistics', () => {
      // Create some test data
      vfsMemFS.writeFile('/stats-test-1.txt', 'Content 1');
      vfsMemFS.writeFile('/stats-test-2.txt', 'Content 2');
      vfsMemFS.createDirectory('/stats-dir');
      
      const stats = vfsMemFS.getStatistics();
      
      expect(stats).to.have.all.keys('dirtyFiles', 'cachedFiles', 'totalFiles', 'syncInProgress', 'lastSyncTime');
      expect(stats.dirtyFiles).to.be.a('number');
      expect(stats.cachedFiles).to.be.a('number');
      expect(stats.totalFiles).to.be.a('number');
      expect(stats.syncInProgress).to.be.a('boolean');
      expect(stats.totalFiles).to.be.at.least(3); // 2 files + 1 directory
      
      console.log(`✅ VFSMemFS statistics:`, stats);
    });

    it('should track sync status correctly', () => {
      // In sync mode, syncInProgress should be false after operations
      const filePath = '/sync-status-test.txt';
      vfsMemFS.writeFile(filePath, 'Sync test content');
      
      const stats = vfsMemFS.getStatistics();
      expect(stats.syncInProgress).to.be.false;
      
      console.log(`✅ Sync status tracking working correctly`);
      console.log(`   Current stats:`, stats);
    });

    it('should work in flush mode', () => {
      // Create a new VFSMemFS instance in flush mode
      const flushVFSMemFS = new VFSMemFS({
        vfs: mockVFS,
        baseDirectory: '/flush-test',
        writeMode: 'flush',
        prePopulate: false,
        cacheOnRead: true
      });
      
      const filePath = '/flush-test-file.txt';
      const content = 'Flush mode test content';
      
      // Write in flush mode (should not immediately sync)
      flushVFSMemFS.writeFile(filePath, content);
      console.log(`✅ Written file in flush mode: ${filePath}`);
      
      // Read through VFSMemFS - should get the content
      const fileNode = flushVFSMemFS.resolvePath(filePath);
      expect(fileNode).to.exist;
      expect(fileNode.isFile()).to.be.true;
      const readContent = fileNode.read();
      expect(readContent).to.equal(content);
      console.log(`✅ Read file in flush mode: ${filePath}`);
      
      // Check stats - should have dirty files in flush mode
      const stats = flushVFSMemFS.getStatistics();
      expect(stats.dirtyFiles).to.be.at.least(1);
      console.log(`✅ Flush mode stats:`, stats);
    });
  });

  afterEach(function() {
    // No cleanup needed since we're using in-memory operations only
    console.log(`\n🧹 Test completed - all operations were in-memory only`);
  });
});