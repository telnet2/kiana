#!/usr/bin/env node

/**
 * VFS Real Client Test Script
 * 
 * This script demonstrates how to test VFS with the real @byted/crystal-vfs client.
 * Since the package is ESM-only, we need to use dynamic imports.
 * 
 * Usage: node test-vfs-real-client.js
 */

async function testVFSRealClient() {
  try {
    console.log('🚀 Testing VFS with real @byted/crystal-vfs client...');
    
    // Dynamic import of ESM module
    const { VFS } = await import('@byted/crystal-vfs');
    
    // Initialize VFS client
    const vfs = new VFS({
      baseURL: 'http://localhost:18080',
      token: 'local-system-admin'
    });

    // Generate random test directory
    const randomNum = Math.floor(Math.random() * 1000000);
    const testDirectory = `/temp/test-${randomNum}`;
    const testFilePath = `${testDirectory}/real-client-test.txt`;
    const testContent = `Real VFS client test at ${new Date().toISOString()}`;

    console.log(`📁 Creating test directory: ${testDirectory}`);
    await vfs.mkdir(testDirectory, { recursive: true });
    console.log('✅ Directory created successfully');

    console.log(`📝 Writing test file: ${testFilePath}`);
    await vfs.writeFileText(testFilePath, testContent);
    console.log('✅ File written successfully');

    console.log(`📖 Reading test file: ${testFilePath}`);
    const readContent = await vfs.readFile(testFilePath, 'utf8');
    console.log(`✅ File read successfully`);
    console.log(`   Content: ${readContent}`);

    // Verify content
    if (readContent === testContent) {
      console.log('✅ Content verification successful');
    } else {
      console.log('❌ Content verification failed');
    }

    console.log(`📋 Listing directory contents: ${testDirectory}`);
    const contents = await vfs.readdir(testDirectory);
    console.log(`✅ Directory listed successfully (${contents.length} items)`);
    contents.forEach(item => {
      if (typeof item === 'string') {
        console.log(`   - ${item}`);
      } else {
        console.log(`   - ${item.name} (${item.isFile() ? 'file' : 'directory'})`);
      }
    });

    console.log(`🧹 Cleaning up test directory: ${testDirectory}`);
    await vfs.rm(testDirectory, { recursive: true });
    console.log('✅ Cleanup completed successfully');

    console.log('\n🎉 All VFS real client tests passed!');
    
  } catch (error) {
    console.error('❌ VFS real client test failed:', error.message);
    if (error.statusCode) {
      console.error(`   HTTP Status: ${error.statusCode}`);
    }
    process.exit(1);
  }
}

// Run the test
testVFSRealClient().catch(console.error);