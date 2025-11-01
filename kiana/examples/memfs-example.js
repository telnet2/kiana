#!/usr/bin/env node

/**
 * Example usage of MemFS and MemShell
 * This demonstrates the programmatic API usage
 */

const { MemFS, MemShell } = require('../index');

console.log('===== MemFS Example =====\n');

// Create a new in-memory file system
const fs = new MemFS();
console.log('Created new MemFS instance\n');

// Create some directories
console.log('Creating directory structure...');
fs.createDirectories('projects/myapp/src');
fs.createDirectories('projects/myapp/tests');
console.log('Created: /projects/myapp/src and /projects/myapp/tests\n');

// Create some files
console.log('Creating files...');
fs.createFile('projects/myapp/README.md', '# My App\n\nA sample application');
fs.createFile('projects/myapp/src/index.js', `
const greet = (name) => {
    console.log(\`Hello, \${name}!\`);
};

greet('World');
module.exports = { greet };
`);
fs.createFile('projects/myapp/src/utils.js', `
const add = (a, b) => a + b;
const subtract = (a, b) => a - b;

module.exports = { add, subtract };
`);
console.log('Created multiple files\n');

// Navigate and list
console.log('Navigating to /projects/myapp...');
fs.changeDirectory('projects/myapp');
console.log('Current directory:', fs.getCurrentDirectory());
const appDir = fs.resolvePath('.');
console.log('Files in current directory:');
appDir.listChildren().forEach(child => {
    console.log(`  - ${child.name} (${child.isDirectory() ? 'dir' : 'file'})`);
});
console.log('');

// Read a file
console.log('Reading README.md:');
const readme = fs.resolvePath('README.md');
console.log(readme.read());
console.log('');

// Use the shell interface
console.log('\n===== MemShell Example =====\n');
const shell = new MemShell(fs);

// Execute commands
console.log('$ ls -l');
console.log(shell.exec('ls -l'));
console.log('');

console.log('$ cd src');
shell.exec('cd src');
console.log('');

console.log('$ pwd');
console.log(shell.exec('pwd'));
console.log('');

console.log('$ ls');
console.log(shell.exec('ls'));
console.log('');

console.log('$ cat index.js');
console.log(shell.exec('cat index.js'));
console.log('');

// Search for patterns
console.log('$ grep -n const index.js');
console.log(shell.exec('grep -n const index.js'));
console.log('');

// Find files
console.log('$ cd /projects/myapp');
shell.exec('cd /projects/myapp');
console.log('$ find . --name "*.js"');
console.log(shell.exec('find . --name *.js'));
console.log('');

// Create and execute a script
console.log('Creating and executing a test script...');
shell.fs.createFile('test.js', "console.log('Testing node execution'); console.log(2 + 2);");
console.log('$ node test.js');
console.log(shell.exec('node test.js'));
console.log('');

// Use sed to modify a file
console.log('Using sed to replace text...');
shell.fs.createFile('sample.txt', 'Hello World');
console.log('Original: ' + shell.exec('cat sample.txt'));
shell.exec('sed s/World/Universe/g sample.txt');
console.log('Modified: ' + shell.exec('cat sample.txt'));
console.log('');

// Demonstrate module loading in node command
console.log('Testing module require...');
shell.fs.createFile('math.js', 'module.exports = { square: (x) => x * x };');
shell.fs.createFile('main.js', "const math = require('./math.js'); console.log('5 squared is:', math.square(5));");
console.log('$ node main.js');
console.log(shell.exec('node main.js'));
console.log('');

console.log('===== Example Complete =====');
console.log('\nTo try the interactive shell, run: npm link && memsh');
