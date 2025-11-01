const { MemShell } = require('./src/MemShell.js');

console.log('Testing Advanced Grep Features with argparse:\n');

const shell = new MemShell();

// Create test file
shell.exec(`cat << EOF > /test.txt
Line 1: First line
Line 2: Error message
Line 3: Middle line
Line 4: Another error
Line 5: Last line
EOF`);

const testCases = [
    {
        name: '-C flag (context both before and after)',
        command: 'grep -C 1 error /test.txt',
        desc: 'Should show 1 line before and after'
    },
    {
        name: '-C with -n (context with line numbers)',
        command: 'grep -C1 -n error /test.txt',
        desc: 'Context with line numbers'
    },
    {
        name: 'Long form flags',
        command: 'grep --ignore-case --line-number ERROR /test.txt',
        desc: 'Use long form --ignore-case and --line-number'
    },
    {
        name: 'Mixed short and long flags',
        command: 'grep -i --line-number error /test.txt',
        desc: 'Mix -i with --line-number'
    },
    {
        name: 'Error: missing pattern',
        command: 'grep /test.txt',
        expectError: true,
        desc: 'Should show better error from argparse'
    },
    {
        name: '-e with long form',
        command: 'grep --regexp error --regexp Error /test.txt',
        desc: 'Use --regexp instead of -e'
    },
    {
        name: 'Context override (C overrides A and B)',
        command: 'grep -A 0 -B 0 -C 1 error /test.txt',
        desc: '-C 1 should override -A 0 and -B 0'
    }
];

testCases.forEach(({ name, command, desc, expectError }) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${name}]`);
    console.log(`Description: ${desc}`);
    console.log(`Command: ${command}`);
    console.log(`${'='.repeat(70)}`);

    try {
        const result = shell.exec(command);

        if (expectError) {
            console.log(`❌ FAIL: Expected error but got: ${JSON.stringify(result)}`);
        } else {
            console.log('✅ PASS');
            console.log(`Output:\n${result}`);
        }
    } catch (err) {
        if (expectError) {
            console.log(`✅ PASS: Got expected error`);
            console.log(`Error: ${err.message}`);
        } else {
            console.log(`❌ FAIL: Unexpected error`);
            console.log(`Error: ${err.message}`);
        }
    }
});

console.log('\n' + '='.repeat(70));
console.log('Testing complete!');
