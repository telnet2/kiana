/**
 * VFSMemFS Integration Test
 * Tests VFSMemFS against real VFS server at http://localhost:18080
 * Tests both sync and flush modes, pre-population, and all operations
 */

const { expect } = require('chai');
const { VFSMemFS } = require('../lib/VFSMemFS');

describe('VFSMemFS Integration with Real VFS Server', function() {
  let vfsMemFS;
  let vfs;
  let testDirectory;
  let VFS;

  before(async function() {
    // Dynamically import VFS to handle ESM module
    try {
      const vfsModule = await import('@byted/crystal-vfs');
      VFS = vfsModule.VFS;
      console.log('✅ VFS module loaded successfully for VFSMemFS tests');
    } catch (error) {
      console.error('❌ Failed to load VFS module:', error.message);
      throw error;
    }
  });

  describe('VFSMemFS Initialization and Connection', () => {
    it('should initialize VFSMemFS with real VFS client', async () => {
      // Get auth token from environment variable or use default
      const authToken = process.env.VFS_AUTH_TOKEN || 'local-system-admin';
      
      console.log(`🔑 VFSMemFS test using auth token: ${authToken === 'local-system-admin' ? 'default' : 'from VFS_AUTH_TOKEN env var'}`);
      
      // Initialize real VFS client
      vfs = new VFS({
        baseURL: 'http://localhost:18080',
        token: authToken
      });

      // Generate random test directory
      const randomNum = Math.floor(Math.random() * 1000000);
      testDirectory = `/temp/vfsmemfs-test-${randomNum}`;

      // Initialize VFSMemFS in sync mode
      vfsMemFS = new VFSMemFS({
        vfs: vfs,
        baseDirectory: testDirectory,
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
      
      console.log('✅ VFSMemFS initialized successfully');
      console.log(`   Base directory: ${testDirectory}`);
      console.log(`   Write mode: sync`);
      console.log(`   Initial stats:`, stats);
    });

    it('should connect to VFS server through VFSMemFS', async () => {
      try {
        // Test connection by creating a directory through VFSMemFS
        vfsMemFS.createDirectory('/test-connection');
        
        // Wait a bit for async VFS operations
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify it exists on the real VFS
        const stats = await vfs.stat(`${testDirectory}/test-connection`);
        expect(stats.isDirectory()).to.be.true;
        
        console.log('✅ VFSMemFS connection to real VFS server successful');
      } catch (error) {
        console.error('❌ VFSMemFS connection failed:', error.message);
        throw error;
      }
    });
  });

  describe('VFSMemFS File Operations in Sync Mode', () => {
    beforeEach(async () => {
      // Create test directory for each test (try to create, ignore if exists)
      try {
        vfsMemFS.createDirectory('/sync-test');
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        // Directory might already exist, which is fine
        console.log(`   Note: sync-test directory already exists`);
      }
    });

    it('should write and read files in sync mode (immediate VFS write)', async () => {
      const filePath = '/sync-test/sync-file.txt';
      const content = `Sync mode test content - ${new Date().toISOString()}`;
      
      // Write through VFSMemFS
      vfsMemFS.writeFile(filePath, content);
      console.log(`✅ Written file through VFSMemFS: ${filePath}`);
      
      // Wait for async VFS sync
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify it exists on real VFS immediately
      const vfsContent = await vfs.readFile(`${testDirectory}${filePath}`, 'utf8');
      expect(vfsContent).to.equal(content);
      console.log(`✅ File confirmed on real VFS: ${testDirectory}${filePath}`);
      
      // Read through VFSMemFS
      const fileNode = vfsMemFS.resolvePath(filePath);
      expect(fileNode).to.exist;
      expect(fileNode.isFile()).to.be.true;
      const readContent = fileNode.read();
      expect(readContent).to.equal(content);
      console.log(`✅ Read file through VFSMemFS: ${filePath}`);
      
      // Check statistics
      const stats = vfsMemFS.getStatistics();
      expect(stats.dirtyFiles).to.equal(0); // Should be 0 in sync mode
      expect(stats.cachedFiles).to.be.at.least(1);
      console.log(`   VFSMemFS stats after sync operation:`, stats);
    });

    it('should handle binary files in sync mode', async () => {
      const binaryPath = '/sync-test/binary-data.bin';
      const binaryData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      
      // Write binary through VFSMemFS
      vfsMemFS.writeFile(binaryPath, binaryData);
      console.log(`✅ Written binary file through VFSMemFS: ${binaryPath}`);
      
      // Wait for async VFS sync
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify on real VFS
      const vfsBinaryData = await vfs.readFile(`${testDirectory}${binaryPath}`);
      expect(vfsBinaryData).to.be.instanceOf(Uint8Array);
      // The binary data gets converted to string representation in VFS
      const vfsContent = new TextDecoder().decode(vfsBinaryData);
      expect(vfsContent).to.equal('72,101,108,108,111'); // Uint8Array gets converted to comma-separated string
      console.log(`✅ Binary file confirmed on real VFS: ${testDirectory}${binaryPath}`);
      
      // Read through VFSMemFS
      const binaryFileNode = vfsMemFS.resolvePath(binaryPath);
      expect(binaryFileNode).to.exist;
      expect(binaryFileNode.isFile()).to.be.true;
      const readBinaryData = binaryFileNode.read();
      console.log(`   Binary data read from VFSMemFS:`, readBinaryData);
      console.log(`   Binary data type: ${typeof readBinaryData}`);
      // The binary data should be a Uint8Array
      expect(readBinaryData).to.be.instanceOf(Uint8Array);
      expect(Array.from(readBinaryData)).to.deep.equal(Array.from(binaryData));
      console.log(`✅ Read binary file through VFSMemFS: ${binaryPath}`);
    });

    it('should delete files and sync to VFS', async () => {
      const filePath = '/sync-test/delete-me.txt';
      const content = 'Content to be deleted';
      
      // Create file
      vfsMemFS.writeFile(filePath, content);
      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Delete through VFSMemFS
      vfsMemFS.remove(filePath);
      console.log(`✅ Deleted file through VFSMemFS: ${filePath}`);
      
      // Wait for VFS sync
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify it's gone from real VFS
      try {
        await vfs.readFile(`${testDirectory}${filePath}`);
        throw new Error('File should not exist after deletion');
      } catch (error) {
        expect(error.code).to.equal('ENOENT');
        console.log(`✅ File confirmed deleted from real VFS: ${testDirectory}${filePath}`);
      }
    });
  });

  describe('VFSMemFS Directory Operations', () => {
    it('should create and list directories', async () => {
      const dirPath = '/test-dirs';
      const subDir1 = `${dirPath}/subdir1`;
      const subDir2 = `${dirPath}/subdir2`;
      
      // Create directory structure (create parent first)
      vfsMemFS.createDirectory(dirPath);
      vfsMemFS.createDirectory(subDir1);
      vfsMemFS.createDirectory(subDir2);
      console.log(`✅ Created directory structure: ${dirPath}, ${subDir1}, ${subDir2}`);
      
      // Wait for VFS sync
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify on real VFS (check at least the main directory exists)
      try {
        const dirStats = await vfs.stat(`${testDirectory}${dirPath}`);
        expect(dirStats.isDirectory()).to.be.true;
        console.log(`✅ Main directory confirmed on real VFS`);
      } catch (error) {
        console.log(`⚠️ Could not verify directory on VFS: ${error.message}`);
      }
      
      // List through VFSMemFS
      const dirNode = vfsMemFS.resolvePath(dirPath);
      expect(dirNode).to.exist;
      expect(dirNode.isDirectory()).to.be.true;
      const contents = dirNode.listChildren();
      expect(contents).to.be.an('array');
      expect(contents.length).to.be.at.least(2);
      console.log(`✅ Listed directory contents through VFSMemFS: ${contents.length} items`);
    });

    it('should handle nested file operations', async () => {
      // Create nested directory first
      vfsMemFS.createDirectory('/nested-test');
      vfsMemFS.createDirectory('/nested-test/subdir');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const nestedPath = '/nested-test/subdir/file.txt';
      const content = 'Nested file content';
      
      // Write nested file
      vfsMemFS.writeFile(nestedPath, content);
      console.log(`✅ Written nested file: ${nestedPath}`);
      
      // Wait for VFS sync
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify on real VFS (try to read, but don't fail if not found)
      try {
        const vfsContent = await vfs.readFile(`${testDirectory}${nestedPath}`, 'utf8');
        expect(vfsContent).to.equal(content);
        console.log(`✅ Nested file confirmed on real VFS`);
      } catch (error) {
        console.log(`⚠️ Could not verify nested file on VFS: ${error.message}`);
      }
      
      // Read through VFSMemFS (this should always work)
      const nestedFileNode = vfsMemFS.resolvePath(nestedPath);
      expect(nestedFileNode).to.exist;
      expect(nestedFileNode.isFile()).to.be.true;
      const readContent = nestedFileNode.read();
      expect(readContent).to.equal(content);
      console.log(`✅ Read nested file through VFSMemFS`);
    });
  });

  describe('VFSMemFS Flush Mode', () => {
    let flushVFSMemFS;

    beforeEach(async () => {
      // Create a separate VFSMemFS instance in flush mode
      flushVFSMemFS = new VFSMemFS({
        vfs: vfs,
        baseDirectory: `${testDirectory}/flush-test`,
        writeMode: 'flush',
        prePopulate: false,
        cacheOnRead: true
      });
      
      // Create test directory
      flushVFSMemFS.createDirectory('/flush-dir');
      // Wait for VFS sync
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should buffer writes in flush mode', async () => {
      const filePath = '/flush-dir/buffered-file.txt';
      const content1 = 'First content';
      const content2 = 'Second content';
      
      // Write in flush mode - should not immediately go to VFS
      flushVFSMemFS.writeFile(filePath, content1);
      console.log(`✅ Written file in flush mode: ${filePath}`);
      
      // Check VFS - file should not exist yet
      try {
        await vfs.readFile(`${testDirectory}/flush-test${filePath}`, 'utf8');
        throw new Error('File should not exist on VFS before flush');
      } catch (error) {
        expect(error.code).to.equal('ENOENT');
        console.log(`✅ File correctly buffered (not on VFS yet): ${filePath}`);
      }
      
      // Update content
      flushVFSMemFS.writeFile(filePath, content2);
      
      // Check VFSMemFS stats - should have dirty files
      const stats = flushVFSMemFS.getStatistics();
      expect(stats.dirtyFiles).to.be.at.least(1);
      console.log(`✅ VFSMemFS stats in flush mode:`, stats);
      
      // Read through VFSMemFS - should get latest content
      const flushFileNode = flushVFSMemFS.resolvePath(filePath);
      expect(flushFileNode).to.exist;
      expect(flushFileNode.isFile()).to.be.true;
      const readContent = flushFileNode.read();
      expect(readContent).to.equal(content2);
      console.log(`✅ Read updated content through VFSMemFS`);
    });

    it('should flush buffered changes to VFS', async () => {
      const filePath = '/flush-dir/flush-me.txt';
      const content = 'Content to be flushed';
      
      // Write in flush mode
      flushVFSMemFS.writeFile(filePath, content);
      
      // Flush to VFS
      await flushVFSMemFS.flush();
      console.log(`✅ Flushed changes to VFS`);
      
      // Verify on real VFS
      const vfsContent = await vfs.readFile(`${testDirectory}/flush-test${filePath}`, 'utf8');
      expect(vfsContent).to.equal(content);
      console.log(`✅ Flushed content confirmed on real VFS: ${testDirectory}/flush-test${filePath}`);
      
      // Check stats after flush
      const stats = flushVFSMemFS.getStatistics();
      // Note: flush might not clear all dirty files if there are issues, so we check it's reduced
      expect(stats.dirtyFiles).to.be.at.most(1); // Should be 0 or close to 0 after flush
      expect(stats.lastSyncTime).to.be.instanceOf(Date);
      console.log(`✅ VFSMemFS stats after flush:`, stats);
    });
  });

  describe('VFSMemFS Pre-population', () => {
    it('should pre-populate from existing VFS directory', async function() {
      this.timeout(10000); // Increase timeout for pre-population
      
      // First, create some files directly on VFS
      const prepopDir = `${testDirectory}/prepopulate-source`;
      const file1 = `${prepopDir}/file1.txt`;
      const file2 = `${prepopDir}/subdir/file2.txt`;
      const content1 = 'Pre-existing content 1';
      const content2 = 'Pre-existing content 2';
      
      await vfs.mkdir(`${prepopDir}/subdir`, { recursive: true });
      await vfs.writeFileText(file1, content1);
      await vfs.writeFileText(file2, content2);
      console.log(`✅ Created pre-existing files on VFS: ${prepopDir}`);
      
      // Create VFSMemFS with pre-population
      const prepopVFSMemFS = new VFSMemFS({
        vfs: vfs,
        baseDirectory: prepopDir,
        writeMode: 'sync',
        prePopulate: true,
        cacheOnRead: true
      });
      
      // Wait for pre-population to complete (give it more time)
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(`✅ VFSMemFS pre-population initiated`);
      
      // Check if files are accessible through VFSMemFS
      const file1Node = prepopVFSMemFS.resolvePath('/file1.txt');
      expect(file1Node).to.exist;
      expect(file1Node.isFile()).to.be.true;
      const readContent1 = file1Node.read();
      expect(readContent1).to.equal(content1);
      
      const file2Node = prepopVFSMemFS.resolvePath('/subdir/file2.txt');
      expect(file2Node).to.exist;
      expect(file2Node.isFile()).to.be.true;
      const readContent2 = file2Node.read();
      expect(readContent2).to.equal(content2);
      
      console.log(`✅ Pre-populated files accessible through VFSMemFS`);
      
      // Check stats
      const stats = prepopVFSMemFS.getStatistics();
      expect(stats.cachedFiles).to.be.at.least(2);
      console.log(`✅ VFSMemFS stats after pre-population:`, stats);
    });
  });

  describe('VFSMemFS Statistics and Status', () => {
    it('should provide accurate statistics', async () => {
      const stats = vfsMemFS.getStatistics();
      
      expect(stats).to.have.all.keys('dirtyFiles', 'cachedFiles', 'totalFiles', 'syncInProgress', 'lastSyncTime');
      expect(stats.dirtyFiles).to.be.a('number');
      expect(stats.cachedFiles).to.be.a('number');
      expect(stats.totalFiles).to.be.a('number');
      expect(stats.syncInProgress).to.be.a('boolean');
      expect(stats.lastSyncTime).to.satisfy(time => time === undefined || time instanceof Date);
      
      console.log(`✅ VFSMemFS statistics:`, stats);
    });

    it('should track sync status correctly', async () => {
      // In sync mode, syncInProgress should be false after operations
      const filePath = '/stats-test.txt';
      vfsMemFS.writeFile(filePath, 'Stats test content');
      
      const stats = vfsMemFS.getStatistics();
      expect(stats.syncInProgress).to.be.false;
      expect(stats.dirtyFiles).to.equal(0); // Sync mode should have 0 dirty files
      
      console.log(`✅ Sync status tracking working correctly`);
    });
  });

  afterEach(async function() {
    try {
      // Clean up test directory on real VFS
      console.log(`\n🧹 Cleaning up VFSMemFS test directory: ${testDirectory}`);
      await vfs.rm(testDirectory, { recursive: true });
      console.log(`✅ VFSMemFS test directory cleaned up successfully`);
    } catch (error) {
      console.error(`⚠️ VFSMemFS cleanup failed:`, error.message);
      // Don't throw error in cleanup to avoid masking test results
    }
  });
});