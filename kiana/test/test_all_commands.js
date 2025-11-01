const { MemShell } = require('./src/MemShell.js');

console.log('Testing All Commands with argparse:\n');

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

// Test ls
console.log('\n=== Testing ls ===');
test('ls: basic listing', () => {
    shell.exec('mkdir /testdir');
    shell.exec('touch /testdir/file1.txt');
    shell.exec('touch /testdir/file2.txt');
    const result = shell.exec('ls /testdir');
    if (!result.includes('file1.txt') || !result.includes('file2.txt')) {
        throw new Error('Files not listed');
    }
});

test('ls: -l flag', () => {
    const result = shell.exec('ls -l /testdir');
    if (!result.includes('rwxr-xr-x')) {
        throw new Error('Long format not working');
    }
});

test('ls: -a flag', () => {
    const result = shell.exec('ls -a /testdir');
    if (!result.includes('.') || !result.includes('..')) {
        throw new Error('Hidden files not shown');
    }
});

test('ls: --all long flag', () => {
    const result = shell.exec('ls --all /testdir');
    if (!result.includes('.')) {
        throw new Error('Long flag --all not working');
    }
});

// Test cat
console.log('\n=== Testing cat ===');
test('cat: basic file read', () => {
    shell.exec('write /test.txt hello world');
    const result = shell.exec('cat /test.txt');
    if (result !== 'hello world') {
        throw new Error(`Expected "hello world", got "${result}"`);
    }
});

test('cat: -n flag (line numbers)', () => {
    shell.exec(`cat << EOF > /lines.txt
line1
line2
line3
EOF`);
    const result = shell.exec('cat -n /lines.txt');
    if (!result.includes('     1  line1')) {
        throw new Error('Line numbers not working');
    }
});

test('cat: --number long flag', () => {
    const result = shell.exec('cat --number /lines.txt');
    if (!result.includes('     1  line1')) {
        throw new Error('Long flag --number not working');
    }
});

test('cat: multiple files', () => {
    shell.exec('write /a.txt AAA');
    shell.exec('write /b.txt BBB');
    const result = shell.exec('cat /a.txt /b.txt');
    if (result !== 'AAABBB') {
        throw new Error('Multiple files not concatenated');
    }
});

test('cat: from stdin', () => {
    const result = shell.exec('echo test | cat');
    if (result !== 'test') {
        throw new Error('stdin not working');
    }
});

// Test mkdir
console.log('\n=== Testing mkdir ===');
test('mkdir: basic directory creation', () => {
    shell.exec('mkdir /newdir');
    const result = shell.exec('ls /');
    if (!result.includes('newdir')) {
        throw new Error('Directory not created');
    }
});

test('mkdir: -p flag (parents)', () => {
    shell.exec('mkdir -p /a/b/c/d');
    shell.exec('touch /a/b/c/d/file.txt');
    const result = shell.exec('ls /a/b/c/d');
    if (!result.includes('file.txt')) {
        throw new Error('Parent directories not created');
    }
});

test('mkdir: --parents long flag', () => {
    shell.exec('mkdir --parents /x/y/z');
    const result = shell.exec('ls /x/y');
    if (!result.includes('z')) {
        throw new Error('Long flag --parents not working');
    }
});

// Test touch
console.log('\n=== Testing touch ===');
test('touch: create new file', () => {
    shell.exec('touch /newfile.txt');
    const result = shell.exec('ls /');
    if (!result.includes('newfile.txt')) {
        throw new Error('File not created');
    }
});

test('touch: multiple files', () => {
    shell.exec('touch /f1.txt /f2.txt /f3.txt');
    const result = shell.exec('ls /');
    if (!result.includes('f1.txt') || !result.includes('f2.txt') || !result.includes('f3.txt')) {
        throw new Error('Multiple files not created');
    }
});

// Test rm
console.log('\n=== Testing rm ===');
test('rm: remove file', () => {
    shell.exec('touch /removeme.txt');
    shell.exec('rm /removeme.txt');
    const result = shell.exec('ls /');
    if (result.includes('removeme.txt')) {
        throw new Error('File not removed');
    }
});

test('rm: -r flag (recursive)', () => {
    shell.exec('mkdir /rmdir');
    shell.exec('touch /rmdir/file.txt');
    shell.exec('rm -r /rmdir');
    const result = shell.exec('ls /');
    if (result.includes('rmdir')) {
        throw new Error('Directory not removed');
    }
});

test('rm: --recursive long flag', () => {
    shell.exec('mkdir /rmdir2');
    shell.exec('touch /rmdir2/file.txt');
    shell.exec('rm --recursive /rmdir2');
    const result = shell.exec('ls /');
    if (result.includes('rmdir2')) {
        throw new Error('Long flag --recursive not working');
    }
});

// Test find
console.log('\n=== Testing find ===');
test('find: basic search', () => {
    shell.exec('mkdir /search');
    shell.exec('touch /search/test.txt');
    shell.exec('touch /search/test.js');
    const result = shell.exec('find /search');
    if (!result.includes('/search/test.txt')) {
        throw new Error('File not found');
    }
});

test('find: -name flag', () => {
    const result = shell.exec('find /search -name "*.txt"');
    if (!result.includes('test.txt') || result.includes('test.js')) {
        throw new Error('-name flag not working');
    }
});

test('find: -type flag', () => {
    shell.exec('mkdir /search/subdir');
    const result = shell.exec('find /search -type f');
    if (result.includes('subdir') || !result.includes('test.txt')) {
        throw new Error('-type f flag not working');
    }
});

test('find: -maxdepth flag', () => {
    shell.exec('mkdir -p /deep/a/b/c');
    shell.exec('touch /deep/root.txt');
    shell.exec('touch /deep/a/a.txt');
    shell.exec('touch /deep/a/b/b.txt');
    const result = shell.exec('find /deep -maxdepth 2 -type f');
    if (!result.includes('root.txt') || !result.includes('a.txt') || result.includes('b.txt')) {
        throw new Error('-maxdepth flag not working');
    }
});

// Test sed
console.log('\n=== Testing sed ===');
test('sed: basic substitution', () => {
    shell.exec('write /sed.txt "hello world"');
    const result = shell.exec('sed s/hello/goodbye/ /sed.txt');
    if (result !== 'goodbye world') {
        throw new Error('Substitution not working');
    }
});

test('sed: -e flag (expression)', () => {
    shell.exec('write /sed2.txt "one two"');
    const result = shell.exec('sed -e s/one/1/g -e s/two/2/g /sed2.txt');
    if (result !== '1 2') {
        throw new Error('-e flag not working');
    }
});

test('sed: from stdin', () => {
    const result = shell.exec('echo "foo bar" | sed s/foo/baz/');
    if (result !== 'baz bar') {
        throw new Error('stdin not working');
    }
});

test('sed: -i flag (in-place)', () => {
    shell.exec('write /inplace.txt "original"');
    shell.exec('sed -i s/original/modified/ /inplace.txt');
    const result = shell.exec('cat /inplace.txt');
    if (result !== 'modified') {
        throw new Error('-i flag not working');
    }
});

// Test grep (already tested separately, but add a few more)
console.log('\n=== Testing grep ===');
test('grep: basic search', () => {
    shell.exec('write /grep.txt "line1\\nline2\\nline3"');
    const result = shell.exec('grep line2 /grep.txt');
    if (!result.includes('line2')) {
        throw new Error('Pattern not found');
    }
});

test('grep: combined flags', () => {
    shell.exec('write /grep2.txt "ERROR\\nWARNING\\nINFO"');
    const result = shell.exec('grep -niA1 error /grep2.txt');
    if (!result.includes('1:ERROR') || !result.includes('WARNING')) {
        throw new Error('Combined flags not working');
    }
});

// Test write
console.log('\n=== Testing write ===');
test('write: create new file', () => {
    shell.exec('write /write.txt hello from write');
    const result = shell.exec('cat /write.txt');
    if (result !== 'hello from write') {
        throw new Error('Content not written');
    }
});

test('write: overwrite existing file', () => {
    shell.exec('write /write.txt new content');
    const result = shell.exec('cat /write.txt');
    if (result !== 'new content') {
        throw new Error('File not overwritten');
    }
});

// Test command chaining
console.log('\n=== Testing Command Chaining ===');
test('pipe with argparse commands', () => {
    const result = shell.exec('echo "test\\ndata\\ntest" | grep test | cat -n');
    if (!result.includes('1  test')) {
        throw new Error('Pipe not working');
    }
});

test('&& operator', () => {
    const result = shell.exec('mkdir /chain && touch /chain/file.txt && ls /chain');
    if (!result.includes('file.txt')) {
        throw new Error('&& not working');
    }
});

test('|| operator', () => {
    const result = shell.exec('cat /nonexistent || echo fallback');
    if (result !== 'fallback') {
        throw new Error('|| not working');
    }
});

// Summary
console.log('\n' + '='.repeat(70));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(70));

if (testsFailed === 0) {
    console.log('✅ All tests passed!');
} else {
    console.log(`❌ ${testsFailed} test(s) failed`);
    process.exit(1);
}
