/**
 * VFS Integration Test - CommonJS Compatible Version
 * Tests connection to VFS server at http://localhost:18080 with VFS_AUTH_TOKEN environment variable
 * This version uses dynamic imports to handle ESM modules in CommonJS context
 */

const { expect } = require('chai');

describe('VFS Connection and Operations', function() {
  let vfs;
  let testDirectory;
  let VFS;

  before(async function() {
    // Dynamically import VFS to handle ESM module
    try {
      const vfsModule = await import('@byted/crystal-vfs');
      VFS = vfsModule.VFS;
      console.log('✅ VFS module loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load VFS module:', error.message);
      throw error;
    }
  });

  beforeEach(function() {
    // Get auth token from environment variable or use default
    const authToken = process.env.VFS_AUTH_TOKEN || 'local-system-admin';
    
    console.log(`🔑 Using VFS auth token: ${authToken === 'local-system-admin' ? 'default' : 'from VFS_AUTH_TOKEN env var'}`);
    
    // Initialize VFS client
    vfs = new VFS({
      baseURL: 'http://localhost:18080',
      token: authToken
    });

    // Generate random test directory
    const randomNum = Math.floor(Math.random() * 1000000);
    testDirectory = `/temp/test-${randomNum}`;
  });

  describe('VFS Connection', () => {
    it('should connect to VFS server successfully', async () => {
      try {
        // Try to access root directory to test connection
        const rootContents = await vfs.readdir('/');
        expect(rootContents).to.be.an('array');
        console.log('✅ VFS connection successful');
        console.log(`   Root directory contains ${rootContents.length} items`);
      } catch (error) {
        console.error('❌ VFS connection failed:', error.message);
        if (error.statusCode) {
          console.error(`   HTTP Status: ${error.statusCode}`);
        }
        throw error;
      }
    });

    it('should handle authentication correctly', async () => {
      try {
        // Test a simple operation to verify authentication
        await vfs.access('/');
        console.log('✅ VFS authentication successful');
      } catch (error) {
        if (error.statusCode === 401) {
          console.error('❌ VFS authentication failed - invalid token');
        } else if (error.statusCode === 403) {
          console.error('❌ VFS authentication failed - forbidden');
        } else {
          console.error('❌ VFS authentication error:', error.message);
        }
        throw error;
      }
    });
  });

  describe('Directory Operations', () => {
    it('should create test directory', async () => {
      try {
        await vfs.mkdir(testDirectory, { recursive: true });
        console.log(`✅ Created test directory: ${testDirectory}`);
        
        // Verify directory exists
        const stats = await vfs.stat(testDirectory);
        expect(stats.isDirectory()).to.be.true;
        console.log(`   Directory stats: size=${stats.size}, mtime=${stats.mtime}`);
      } catch (error) {
        console.error(`❌ Failed to create directory ${testDirectory}:`, error.message);
        throw error;
      }
    });

    it('should list directory contents', async () => {
      try {
        // Ensure directory exists first
        await vfs.mkdir(testDirectory, { recursive: true });
        
        // Create some test files
        await vfs.writeFileText(`${testDirectory}/file1.txt`, 'Content 1');
        await vfs.writeFileText(`${testDirectory}/file2.txt`, 'Content 2');
        await vfs.mkdir(`${testDirectory}/subdir`, { recursive: true });
        
        // List directory contents
        const contents = await vfs.readdir(testDirectory);
        expect(contents).to.be.an('array');
        expect(contents.length).to.be.at.least(3); // file1.txt, file2.txt, subdir
        
        console.log(`✅ Listed directory contents (${contents.length} items):`);
        contents.forEach((item) => {
          if (typeof item === 'string') {
            console.log(`   - ${item} (string)`);
          } else if (item && typeof item === 'object' && 'name' in item) {
            console.log(`   - ${item.name} (${item.isFile ? 'file' : 'directory'})`);
          }
        });
      } catch (error) {
        console.error(`❌ Failed to list directory ${testDirectory}:`, error.message);
        throw error;
      }
    });
  });

  describe('File Operations', () => {
    it('should write and read text files', async () => {
      try {
        // Ensure directory exists first
        await vfs.mkdir(testDirectory, { recursive: true });
        
        const testFilePath = `${testDirectory}/test-file.txt`;
        const testContent = `Test content generated at ${new Date().toISOString()}`;
        
        // Write file
        await vfs.writeFileText(testFilePath, testContent);
        console.log(`✅ Written file: ${testFilePath}`);
        
        // Read file
        const readContent = await vfs.readFile(testFilePath, 'utf8');
        expect(readContent).to.equal(testContent);
        console.log(`✅ Read file: ${testFilePath}`);
        console.log(`   Content: ${readContent}`);
      } catch (error) {
        console.error(`❌ File operation failed:`, error.message);
        throw error;
      }
    });

    it('should handle JSON file operations', async () => {
      try {
        // Ensure directory exists first
        await vfs.mkdir(testDirectory, { recursive: true });
        
        const jsonFilePath = `${testDirectory}/data.json`;
        const jsonData = {
          name: 'Test Object',
          timestamp: new Date().toISOString(),
          values: [1, 2, 3, 4, 5],
          nested: {
            key: 'value',
            number: 42
          }
        };
        
        // Write JSON file
        await vfs.writeFileJSON(jsonFilePath, jsonData);
        console.log(`✅ Written JSON file: ${jsonFilePath}`);
        
        // Read JSON file
        const readJsonData = await vfs.readFile(jsonFilePath, 'utf8');
        const parsedData = JSON.parse(readJsonData);
        
        expect(parsedData.name).to.equal(jsonData.name);
        expect(parsedData.values).to.deep.equal(jsonData.values);
        expect(parsedData.nested.key).to.equal(jsonData.nested.key);
        
        console.log(`✅ Read and parsed JSON file successfully`);
      } catch (error) {
        console.error(`❌ JSON file operation failed:`, error.message);
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      try {
        const nonExistentPath = `${testDirectory}/does-not-exist.txt`;
        
        await vfs.readFile(nonExistentPath, 'utf8');
        throw new Error('Should have thrown an error for non-existent file');
      } catch (error) {
        expect(error.code).to.equal('ENOENT');
        console.log(`✅ Correctly handled non-existent file: ${error.message}`);
      }
    });
  });

  afterEach(async function() {
    try {
      // Clean up test directory
      console.log(`\n🧹 Cleaning up test directory: ${testDirectory}`);
      await vfs.rm(testDirectory, { recursive: true });
      console.log(`✅ Test directory cleaned up successfully`);
    } catch (error) {
      console.error(`⚠️ Cleanup failed:`, error.message);
      // Don't throw error in cleanup to avoid masking test results
    }
  });
});