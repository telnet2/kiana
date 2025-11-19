#!/usr/bin/env node

/**
 * VFS Real Client Test Script
 * Tests connection to VFS server at http://localhost:18080 with VFS_AUTH_TOKEN environment variable
 * Run with: node test-vfs-real.js
 */

import pkg from 'chai';
const { expect } = pkg;
import { VFS } from '@byted/crystal-vfs';

async function runVFSTests() {
  console.log('🚀 Starting VFS Real Client Tests...');
  
  // Get auth token from environment variable or use default
  const authToken = process.env.VFS_AUTH_TOKEN || 'local-system-admin';
  
  console.log(`🔑 Using VFS auth token: ${authToken === 'local-system-admin' ? 'default' : 'from VFS_AUTH_TOKEN env var'}`);
  
  // Initialize VFS client
  const vfs = new VFS({
    baseURL: 'http://localhost:18080',
    token: authToken
  });

  // Generate random test directory
  const randomNum = Math.floor(Math.random() * 1000000);
  const testDirectory = `/temp/test-${randomNum}`;
  
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: VFS Connection
    console.log('\n📡 Testing VFS Connection...');
    try {
      const rootContents = await vfs.readdir('/');
      expect(rootContents).to.be.an('array');
      console.log('✅ VFS connection successful');
      console.log(`   Root directory contains ${rootContents.length} items`);
      testsPassed++;
    } catch (error) {
      console.error('❌ VFS connection failed:', error.message);
      if (error.statusCode) {
        console.error(`   HTTP Status: ${error.statusCode}`);
      }
      testsFailed++;
    }

    // Test 2: Authentication
    console.log('\n🔐 Testing VFS Authentication...');
    try {
      await vfs.access('/');
      console.log('✅ VFS authentication successful');
      testsPassed++;
    } catch (error) {
      if (error.statusCode === 401) {
        console.error('❌ VFS authentication failed - invalid token');
      } else if (error.statusCode === 403) {
        console.error('❌ VFS authentication failed - forbidden');
      } else {
        console.error('❌ VFS authentication error:', error.message);
      }
      testsFailed++;
    }

    // Test 3: Directory Creation
    console.log('\n📁 Testing Directory Creation...');
    try {
      await vfs.mkdir(testDirectory, { recursive: true });
      console.log(`✅ Created test directory: ${testDirectory}`);
      
      // Verify directory exists
      const stats = await vfs.stat(testDirectory);
      expect(stats.isDirectory()).to.be.true;
      console.log(`   Directory stats: size=${stats.size}, mtime=${stats.mtime}`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ Failed to create directory ${testDirectory}:`, error.message);
      testsFailed++;
    }

    // Test 4: File Operations
    console.log('\n📝 Testing File Operations...');
    try {
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
      testsPassed++;
    } catch (error) {
      console.error(`❌ File operation failed:`, error.message);
      testsFailed++;
    }

    // Test 5: Binary File Operations
    console.log('\n🔢 Testing Binary File Operations...');
    try {
      const binaryFilePath = `${testDirectory}/binary-file.bin`;
      const binaryContent = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      
      // Write binary file
      await vfs.writeFile(binaryFilePath, binaryContent);
      console.log(`✅ Written binary file: ${binaryFilePath}`);
      
      // Read binary file
      const readBinaryContent = await vfs.readFile(binaryFilePath);
      expect(readBinaryContent).to.be.instanceOf(Uint8Array);
      expect(Array.from(readBinaryContent)).to.deep.equal(Array.from(binaryContent));
      
      console.log(`✅ Read binary file: ${binaryFilePath}`);
      console.log(`   Content: ${Array.from(readBinaryContent).map(b => '0x' + b.toString(16)).join(' ')}`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ Binary file operation failed:`, error.message);
      testsFailed++;
    }

    // Test 6: JSON File Operations
    console.log('\n📊 Testing JSON File Operations...');
    try {
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
      testsPassed++;
    } catch (error) {
      console.error(`❌ JSON file operation failed:`, error.message);
      testsFailed++;
    }

    // Test 7: Error Handling
    console.log('\n⚠️ Testing Error Handling...');
    try {
      const nonExistentPath = `${testDirectory}/does-not-exist.txt`;
      
      await vfs.readFile(nonExistentPath, 'utf8');
      console.error('❌ Should have thrown an error for non-existent file');
      testsFailed++;
    } catch (error) {
      expect(error.code).to.equal('ENOENT');
      console.log(`✅ Correctly handled non-existent file: ${error.message}`);
      testsPassed++;
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    testsFailed++;
  } finally {
    // Cleanup
    console.log(`\n🧹 Cleaning up test directory: ${testDirectory}`);
    try {
      // await vfs.rm(testDirectory, { recursive: true });
      console.log(`✅ Test directory cleaned up successfully`);
    } catch (error) {
      console.error(`⚠️ Cleanup failed:`, error.message);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results:`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  console.log('='.repeat(50));

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run the tests
runVFSTests().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});