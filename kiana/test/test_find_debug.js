const { MemShell } = require('./src/MemShell.js');

const shell = new MemShell();
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${err.message}`);
        testsFailed++;
    }
}

// Reproduce exactly like test_all_commands - run ALL tests that come before find
console.log('=== Running all tests before find ===');

// Test ls (creates files)
shell.exec('mkdir /testdir');
shell.exec('touch /testdir/file1.txt');
shell.exec('touch /testdir/file2.txt');

// Test cat
shell.exec('write /test.txt hello world');
shell.exec('cat << EOF > /lines.txt\nline1\nline2\nline3\nEOF');

// Test mkdir
shell.exec('mkdir /newdir');
shell.exec('mkdir -p /a/b/c/d');
shell.exec('touch /a/b/c/d/file.txt');

// Test touch
shell.exec('touch /newfile.txt');
shell.exec('touch /f1.txt /f2.txt /f3.txt');

// Test rm
shell.exec('touch /removeme.txt');
shell.exec('rm /removeme.txt');

console.log('\n=== Now testing find ===');

test('find: basic search', () => {
    shell.exec('mkdir /search');
    shell.exec('touch /search/test.txt');
    shell.exec('touch /search/test.js');
    const result = shell.exec('find /search');
    if (!result.includes('/search/test.txt')) {
        throw new Error('File not found');
    }
});

// List all files before running second test
console.log('\nAll .txt files in filesystem:');
const allFiles = shell.getAllFilesRecursive('/');
const txtFiles = allFiles.filter(f => f.endsWith('.txt'));
console.log(txtFiles);
console.log(`Total: ${txtFiles.length} .txt files`);

// Check what expandWildcards does
console.log('\nExpanding *.txt from /search:');
const expanded = shell.expandWildcards(['*.txt'], '/search');
console.log(expanded);

console.log('\nExpanding *.txt from / (root):');
const expandedRoot = shell.expandWildcards(['*.txt'], '/');
console.log(expandedRoot);

test('find: -name flag', () => {
    const result = shell.exec('find /search -name "*.txt"');
    console.log('  Find result:', result);
    console.log('  Includes test.txt?', result.includes('test.txt'));
    console.log('  Includes test.js?', result.includes('test.js'));
    if (!result.includes('test.txt') || result.includes('test.js')) {
        throw new Error('-name flag not working');
    }
});

console.log(`\nTests passed: ${testsPassed}, failed: ${testsFailed}`);
