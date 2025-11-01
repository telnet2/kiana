const { MemShell } = require('./src/MemShell.js');

console.log('Testing patch command:\n');

const shell = new MemShell();

// Create original files
shell.exec(`cat << EOF > /original.txt
line 1
line 2
line 3
line 4
line 5
EOF`);

shell.exec(`cat << EOF > /hello.txt
Hello World
This is a test
Goodbye World
EOF`);

// Create unified diff patch
shell.exec(`cat << EOF > /unified.patch
--- /original.txt
+++ /original.txt
@@ -1,5 +1,5 @@
 line 1
-line 2
+line 2 modified
 line 3
 line 4
-line 5
+line 5 changed
EOF`);

// Create normal diff patch
shell.exec(`cat << EOF > /normal.patch
2c2
< line 2
---
> line 2 modified
5c5
< line 5
---
> line 5 changed
EOF`);

// Create patch with path that needs stripping
shell.exec(`cat << EOF > /strip.patch
--- a/src/hello.txt
+++ b/src/hello.txt
@@ -1,3 +1,3 @@
-Hello World
+Hi World
 This is a test
 Goodbye World
EOF`);

const testCases = [
    {
        name: 'Unified diff format',
        setup: () => {
            shell.exec(`cat << EOF > /test1.txt
line 1
line 2
line 3
line 4
line 5
EOF`);
        },
        command: 'patch -i /unified.patch /test1.txt',
        verify: () => shell.exec('cat /test1.txt'),
        expected: 'line 1\nline 2 modified\nline 3\nline 4\nline 5 changed'
    },
    {
        name: 'Normal diff format',
        setup: () => {
            shell.exec(`cat << EOF > /test2.txt
line 1
line 2
line 3
line 4
line 5
EOF`);
        },
        command: 'patch -i /normal.patch /test2.txt',
        verify: () => shell.exec('cat /test2.txt'),
        expected: 'line 1\nline 2 modified\nline 3\nline 4\nline 5 changed'
    },
    {
        name: 'Patch from stdin',
        setup: () => {
            shell.exec(`cat << EOF > /test3.txt
line 1
line 2
line 3
line 4
line 5
EOF`);
        },
        command: 'cat /unified.patch | patch /test3.txt',
        verify: () => shell.exec('cat /test3.txt'),
        expected: 'line 1\nline 2 modified\nline 3\nline 4\nline 5 changed'
    },
    {
        name: 'Output to file (-o)',
        setup: () => {
            shell.exec(`cat << EOF > /test4.txt
line 1
line 2
line 3
line 4
line 5
EOF`);
        },
        command: 'patch -i /unified.patch -o /test4_patched.txt /test4.txt',
        verify: () => {
            const original = shell.exec('cat /test4.txt');
            const patched = shell.exec('cat /test4_patched.txt');
            return { original, patched };
        },
        expected: {
            original: 'line 1\nline 2\nline 3\nline 4\nline 5',
            patched: 'line 1\nline 2 modified\nline 3\nline 4\nline 5 changed'
        }
    },
    {
        name: 'Reverse patch (-R)',
        setup: () => {
            // Create already-patched file
            shell.exec(`cat << EOF > /test5.txt
line 1
line 2 modified
line 3
line 4
line 5 changed
EOF`);
        },
        command: 'patch -R -i /unified.patch /test5.txt',
        verify: () => shell.exec('cat /test5.txt'),
        expected: 'line 1\nline 2\nline 3\nline 4\nline 5'
    },
    {
        name: 'Path stripping (-p1)',
        setup: () => {
            shell.exec('mkdir -p /src');
            shell.exec(`cat << EOF > /src/hello.txt
Hello World
This is a test
Goodbye World
EOF`);
        },
        command: 'patch -p1 -i /strip.patch /src/hello.txt',
        verify: () => shell.exec('cat /src/hello.txt'),
        expected: 'Hi World\nThis is a test\nGoodbye World'
    },
    {
        name: 'Auto-detect file from patch',
        setup: () => {
            // Unified patch already has /original.txt in headers
            shell.exec(`cat << EOF > /original.txt
line 1
line 2
line 3
line 4
line 5
EOF`);
        },
        command: 'patch -i /unified.patch',
        verify: () => shell.exec('cat /original.txt'),
        expected: 'line 1\nline 2 modified\nline 3\nline 4\nline 5 changed'
    },
    {
        name: 'Help flag (--help)',
        command: 'patch --help',
        verify: () => null,
        checkHelp: true
    },
    {
        name: 'Multiple hunks',
        setup: () => {
            shell.exec(`cat << EOF > /multi.txt
line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8
EOF`);
            shell.exec(`cat << EOF > /multi.patch
--- /multi.txt
+++ /multi.txt
@@ -1,4 +1,4 @@
 line 1
-line 2
+line TWO
 line 3
 line 4
@@ -5,4 +5,4 @@
 line 5
 line 6
-line 7
+line SEVEN
 line 8
EOF`);
        },
        command: 'patch -i /multi.patch /multi.txt',
        verify: () => shell.exec('cat /multi.txt'),
        expected: 'line 1\nline TWO\nline 3\nline 4\nline 5\nline 6\nline SEVEN\nline 8'
    }
];

testCases.forEach(({ name, setup, command, verify, expected, checkHelp }) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${name}]`);
    console.log(`Command: ${command}`);
    console.log(`${'='.repeat(70)}`);

    try {
        if (setup) setup();

        const result = shell.exec(command);

        if (checkHelp) {
            if (result.includes('usage: patch')) {
                console.log('✅ PASS - Help text displayed');
                console.log(result);
            } else {
                console.log('❌ FAIL - Help text not displayed');
                console.log(result);
            }
        } else if (verify) {
            const actual = verify();

            if (typeof expected === 'object') {
                // Multiple values to check
                let allMatch = true;
                for (const [key, value] of Object.entries(expected)) {
                    if (actual[key] !== value) {
                        console.log(`❌ FAIL - ${key} mismatch`);
                        console.log(`Expected:\n${value}`);
                        console.log(`\nActual:\n${actual[key]}`);
                        allMatch = false;
                    }
                }
                if (allMatch) {
                    console.log('✅ PASS');
                    console.log(`Patched content:\n${actual.patched}`);
                }
            } else {
                if (actual === expected) {
                    console.log('✅ PASS');
                    console.log(`Result:\n${actual}`);
                } else {
                    console.log('❌ FAIL');
                    console.log(`Expected:\n${expected}`);
                    console.log(`\nActual:\n${actual}`);
                }
            }
        } else {
            console.log('✅ PASS');
            console.log(`Result: ${result}`);
        }
    } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
    }
});

console.log('\n' + '='.repeat(70));
console.log('Patch testing complete!');
