#!/usr/bin/env node

/**
 * VFS-Integrated MemFS Example
 * 
 * This example demonstrates how to use MemFS as a shell and cache layer for VFS
 * with both sync and flush modes for different persistence strategies.
 */

import { VFS } from '/Users/joohwi.lee/crystal/vfs-v1/csuite/vfs/ts-sdk/vfs/src/index.js';
import { VFSMemShell, VFSMemSession } from '../lib/index.js';

// Mock VFS client for demonstration
// In real usage, you would use the actual VFS client from the SDK
class MockVFSClient {
  constructor() {
    this.files = new Map();
    this.directories = new Set(['/']);
  }

  async readFile(path, encoding = 'utf8') {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return this.files.get(path);
  }

  async writeFile(path, data, options = {}) {
    this.files.set(path, data);
    
    // Ensure parent directory exists
    const parentDir = path.split('/').slice(0, -1).join('/') || '/';
    if (parentDir !== '/') {
      this.directories.add(parentDir);
    }
  }

  async writeFileText(path, text, options = {}) {
    return this.writeFile(path, text, options);
  }

  async appendFile(path, data, options = {}) {
    const existing = this.files.get(path) || '';
    this.files.set(path, existing + data);
  }

  async mkdir(path, options = {}) {
    this.directories.add(path);
    if (options.recursive) {
      const parts = path.split('/').filter(Boolean);
      let current = '/';
      for (const part of parts) {
        current = current === '/' ? `/${part}` : `${current}/${part}`;
        this.directories.add(current);
      }
    }
  }

  async readdir(path, options = {}) {
    const entries = [];
    
    // Add directories
    for (const dir of this.directories) {
      if (dir.startsWith(path + '/') && dir !== path) {
        const relative = dir.slice(path.length + 1);
        if (!relative.includes('/')) {
          entries.push({
            name: relative,
            isFile: () => false,
            isDirectory: () => true
          });
        }
      }
    }
    
    // Add files
    for (const [filePath] of this.files) {
      if (filePath.startsWith(path + '/') && filePath !== path) {
        const relative = filePath.slice(path.length + 1);
        if (!relative.includes('/')) {
          entries.push({
            name: relative,
            isFile: () => true,
            isDirectory: () => false
          });
        }
      }
    }
    
    return entries;
  }

  async stat(path) {
    if (this.files.has(path)) {
      const content = this.files.get(path);
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: content.length,
        mtime: new Date(),
        ctime: new Date(),
        mode: 0o644
      };
    }
    
    if (this.directories.has(path)) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
        mtime: new Date(),
        ctime: new Date(),
        mode: 0o755
      };
    }
    
    throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
  }

  async unlink(path) {
    this.files.delete(path);
  }

  async rm(path, options = {}) {
    if (options.recursive) {
      // Remove directory and all contents
      this.directories.delete(path);
      for (const [filePath] of this.files) {
        if (filePath.startsWith(path + '/')) {
          this.files.delete(filePath);
        }
      }
      for (const dir of this.directories) {
        if (dir.startsWith(path + '/')) {
          this.directories.delete(dir);
        }
      }
    } else {
      this.directories.delete(path);
    }
  }

  async rmdir(path, options = {}) {
    return this.rm(path, options);
  }

  async rename(oldPath, newPath) {
    if (this.files.has(oldPath)) {
      const content = this.files.get(oldPath);
      this.files.delete(oldPath);
      this.files.set(newPath, content);
    }
  }

  async copyFile(src, dest, options = {}) {
    if (this.files.has(src)) {
      const content = this.files.get(src);
      this.files.set(dest, content);
    }
  }

  async access(path, mode = 0) {
    if (!this.files.has(path) && !this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
  }
}

/**
 * Example 1: Basic VFS Integration with Flush Mode
 */
async function exampleFlushMode() {
  console.log('\n=== Example 1: Flush Mode (Batch Sync) ===\n');
  
  const vfs = new MockVFSClient();
  const shell = new VFSMemShell({
    vfs,
    baseDirectory: '/projects/example1',
    writeMode: 'flush' // Batch mode - files stay in memory until flush
  });

  // Work with files in memory
  console.log('Creating files in memory...');
  shell.exec('echo "Hello World" > hello.txt');
  shell.exec('echo "Test content" > test.txt');
  shell.exec('mkdir docs');
  shell.exec('echo "Documentation" > docs/README.md');

  // Check status - files should be dirty (not synced to VFS yet)
  console.log('\nStatus before flush:');
  console.log(shell.exec('vfs-status'));

  // Flush to VFS
  console.log('\nFlushing to VFS...');
  console.log(shell.exec('vfs-sync'));

  // Wait a bit for async operations
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\nStatus after flush:');
  console.log(shell.exec('vfs-status'));

  // Verify files are in VFS
  console.log('\nVerifying files in VFS:');
  const files = await vfs.readdir('/projects/example1');
  console.log('Files in VFS:', files.map(f => f.name));
  
  const docsFiles = await vfs.readdir('/projects/example1/docs');
  console.log('Files in docs:', docsFiles.map(f => f.name));
}

/**
 * Example 2: Sync Mode for Real-time Persistence
 */
async function exampleSyncMode() {
  console.log('\n=== Example 2: Sync Mode (Real-time) ===\n');
  
  const vfs = new MockVFSClient();
  const shell = new VFSMemShell({
    vfs,
    baseDirectory: '/projects/example2',
    writeMode: 'sync' // Sync mode - files immediately written to VFS
  });

  console.log('Creating files with immediate VFS sync...');
  shell.exec('echo "Immediate sync" > immediate.txt');
  shell.exec('mkdir src');
  shell.exec('echo "const x = 42;" > src/index.js');

  // Files should be synced immediately
  console.log('\nStatus (should show no dirty files):');
  console.log(shell.exec('vfs-status'));

  // Verify immediate sync
  console.log('\nVerifying immediate sync in VFS:');
  const files = await vfs.readdir('/projects/example2');
  console.log('Files in VFS:', files.map(f => f.name));
  
  const content = await vfs.readFile('/projects/example2/src/index.js');
  console.log('Content of src/index.js:', content);
}

/**
 * Example 3: Session Persistence with VFS
 */
async function exampleSessionPersistence() {
  console.log('\n=== Example 3: Session Persistence ===\n');
  
  const vfs = new MockVFSClient();
  
  // Create session with VFS persistence
  const session = new VFSMemSession({
    vfs,
    baseDirectory: '/user/sessions',
    persistToVFS: true,
    autoSave: true, // Auto-save every 30 seconds
    saveInterval: 5000 // 5 seconds for demo
  });

  const shell = new VFSMemShell({
    vfs,
    baseDirectory: '/projects/example3',
    writeMode: 'flush',
    session
  });

  console.log('Working with persistent session...');
  shell.exec('echo "Session data" > session.txt');
  shell.exec('export PROJECT_NAME="Example Project"');
  shell.exec('mkdir persistent');

  // Manually save session
  console.log('\nSaving session to VFS...');
  const saved = await session.saveToVFS();
  console.log('Session saved:', saved);

  // Show session info
  console.log('\nSession info:');
  const info = session.getVFSInfo();
  console.log(`ID: ${info.id}`);
  console.log(`History size: ${info.historySize}`);
  console.log(`Environment variables: ${info.envVarCount}`);
  console.log(`Working directory: ${info.cwd}`);
  console.log(`Last saved: ${info.lastSaved}`);

  // List sessions
  console.log('\nAvailable sessions:');
  const sessions = await session.listVFSSessions();
  console.log('Sessions:', sessions);

  // Create new session and load the saved one
  console.log('\nLoading saved session...');
  const newSession = new VFSMemSession({
    vfs,
    baseDirectory: '/user/sessions',
    persistToVFS: true
  });

  const loaded = await newSession.loadFromVFS(info.id);
  console.log('Session loaded:', loaded);
  
  if (loaded) {
    console.log('Restored environment:', newSession.getAllEnv());
    console.log('Restored working directory:', newSession.getCwd());
  }
}

/**
 * Example 4: Switching Between Modes
 */
async function exampleModeSwitching() {
  console.log('\n=== Example 4: Mode Switching ===\n');
  
  const vfs = new MockVFSClient();
  const shell = new VFSMemShell({
    vfs,
    baseDirectory: '/projects/example4',
    writeMode: 'flush'
  });

  console.log('Starting in flush mode...');
  shell.exec('echo "Flush mode" > mode-test.txt');
  console.log(shell.exec('vfs-status'));

  console.log('\nSwitching to sync mode...');
  shell.exec('vfs-mode sync');
  console.log(shell.exec('vfs-status'));

  console.log('\nCreating file in sync mode...');
  shell.exec('echo "Sync mode" > sync-file.txt');
  console.log(shell.exec('vfs-status'));

  console.log('\nSwitching back to flush mode...');
  shell.exec('vfs-mode flush');
  console.log(shell.exec('vfs-status'));
}

/**
 * Example 5: VFS Statistics and Monitoring
 */
async function exampleStatistics() {
  console.log('\n=== Example 5: Statistics and Monitoring ===\n');
  
  const vfs = new MockVFSClient();
  const shell = new VFSMemShell({
    vfs,
    baseDirectory: '/projects/example5',
    writeMode: 'flush'
  });

  // Create some files
  shell.exec('echo "File 1" > file1.txt');
  shell.exec('echo "File 2" > file2.txt');
  shell.exec('mkdir docs');
  shell.exec('echo "Doc 1" > docs/doc1.md');
  shell.exec('echo "Doc 2" > docs/doc2.md');

  console.log('Detailed statistics:');
  console.log(shell.exec('vfs-stats'));

  console.log('\nCache management:');
  shell.exec('vfs-cache off');
  console.log(shell.exec('vfs-cache status'));
  shell.exec('vfs-cache on');
  console.log(shell.exec('vfs-cache status'));
}

/**
 * Main function to run all examples
 */
async function main() {
  try {
    console.log('VFS-Integrated MemFS Examples');
    console.log('=============================');

    await exampleFlushMode();
    await exampleSyncMode();
    await exampleSessionPersistence();
    await exampleModeSwitching();
    await exampleStatistics();

    console.log('\n✅ All examples completed successfully!');
    console.log('\nKey takeaways:');
    console.log('- Flush mode: Batch operations, better performance');
    console.log('- Sync mode: Real-time persistence, immediate consistency');
    console.log('- Session persistence: Long-term state management');
    console.log('- Mode switching: Flexible persistence strategies');
    console.log('- Statistics: Comprehensive monitoring and debugging');

  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}