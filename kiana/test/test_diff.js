const { MemShell } = require('./src/MemShell.js');

console.log('Testing diff command:\n');

const shell = new MemShell();

// Create test files
shell.exec(`cat << EOF > /file1.txt
line 1
line 2
line 3
line 4
line 5
EOF`);

shell.exec(`cat << EOF > /file2.txt
line 1
line 2 modified
line 3
line 5
line 6
EOF`);

shell.exec(`cat << EOF > /case1.txt
Hello World
Test Line
EOF`);

shell.exec(`cat << EOF > /case2.txt
hello world
test line
EOF`);

shell.exec(`cat << EOF > /space1.txt
hello    world
test  line
EOF`);

shell.exec(`cat << EOF > /space2.txt
hello world
test line
EOF`);

shell.exec(`cat << EOF > /blank1.txt
line 1

line 2

line 3
EOF`);

shell.exec(`cat << EOF > /blank2.txt
line 1
line 2
line 3
EOF`);

const testCases = [
    {
        name: 'Identical files',
        command: 'diff /file1.txt /file1.txt',
        desc: 'Should return empty (no differences)'
    },
    {
        name: 'Basic diff (normal format)',
        command: 'diff /file1.txt /file2.txt',
        desc: 'Show differences in normal format'
    },
    {
        name: 'Unified format (-u)',
        command: 'diff -u /file1.txt /file2.txt',
        desc: 'Show differences in unified format'
    },
    {
        name: 'Unified format with custom context (-U1)',
        command: 'diff -U1 /file1.txt /file2.txt',
        desc: 'Show 1 line of context'
    },
    {
        name: 'Unified format with custom context (-U 2)',
        command: 'diff -U 2 /file1.txt /file2.txt',
        desc: 'Show 2 lines of context'
    },
    {
        name: 'Context format (-c)',
        command: 'diff -c /file1.txt /file2.txt',
        desc: 'Show differences in context format'
    },
    {
        name: 'Brief mode (-q)',
        command: 'diff -q /file1.txt /file2.txt',
        desc: 'Only report if files differ'
    },
    {
        name: 'Brief mode on identical files',
        command: 'diff -q /file1.txt /file1.txt',
        desc: 'Should return empty'
    },
    {
        name: 'Ignore case (-i)',
        command: 'diff -i /case1.txt /case2.txt',
        desc: 'Should show no differences (case ignored)'
    },
    {
        name: 'Without ignore case',
        command: 'diff /case1.txt /case2.txt',
        desc: 'Should show differences'
    },
    {
        name: 'Ignore all space (-w)',
        command: 'diff -w /space1.txt /space2.txt',
        desc: 'Should show no differences (spaces ignored)'
    },
    {
        name: 'Ignore space change (-b)',
        command: 'diff -b /space1.txt /space2.txt',
        desc: 'Should show no differences (space amount ignored)'
    },
    {
        name: 'Ignore blank lines (-B)',
        command: 'diff -B /blank1.txt /blank2.txt',
        desc: 'Should show no differences (blank lines ignored)'
    },
    {
        name: 'Long form: --unified',
        command: 'diff --unified /file1.txt /file2.txt',
        desc: 'Long form of -u flag'
    },
    {
        name: 'Long form: --brief',
        command: 'diff --brief /file1.txt /file2.txt',
        desc: 'Long form of -q flag'
    },
    {
        name: 'Long form: --ignore-case',
        command: 'diff --ignore-case /case1.txt /case2.txt',
        desc: 'Long form of -i flag'
    },
    {
        name: 'Combined flags: -qi',
        command: 'diff -qi /case1.txt /case2.txt',
        desc: 'Brief mode with case insensitive'
    },
    {
        name: 'Unified with ignore case',
        command: 'diff -ui /case1.txt /case2.txt',
        desc: 'Unified format, case insensitive'
    }
];

testCases.forEach(({ name, command, desc }) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${name}]`);
    console.log(`Description: ${desc}`);
    console.log(`Command: ${command}`);
    console.log(`${'='.repeat(70)}`);

    try {
        const result = shell.exec(command);
        console.log(result || '(no output - files identical)');
    } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
    }
});

console.log('\n' + '='.repeat(70));
console.log('Testing complete!');
