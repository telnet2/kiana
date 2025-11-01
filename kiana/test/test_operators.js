const { MemShell } = require('./src/MemShell.js');

console.log('Testing Shell Operators:\n');

const shell = new MemShell();

// Setup test environment
shell.exec('mkdir /testdir');
shell.exec('echo "success" > /success.txt');
shell.exec('echo "hello" > /test.txt');

const testCases = [
    {
        desc: 'Pipe operator (|)',
        input: 'echo hello | cat',
        expected: 'hello'
    },
    {
        desc: 'AND operator (&&) - both succeed',
        input: 'echo first && echo second',
        expected: 'second'
    },
    {
        desc: 'AND operator (&&) - first fails',
        input: 'cat /nonexistent.txt && echo should_not_run',
        expectError: true
    },
    {
        desc: 'OR operator (||) - first succeeds',
        input: 'echo success || echo should_not_run',
        expected: 'success'
    },
    {
        desc: 'OR operator (||) - first fails',
        input: 'cat /nonexistent.txt || echo fallback',
        expected: 'fallback'
    },
    {
        desc: 'Semicolon (;) - both succeed',
        input: 'echo first ; echo second',
        expected: 'second'
    },
    {
        desc: 'Semicolon (;) - first fails, second runs',
        input: 'cat /nonexistent.txt ; echo still_runs',
        expected: 'still_runs'
    },
    {
        desc: 'Complex: && and ||',
        input: 'echo test && cat /test.txt || echo failed',
        expected: 'hello'
    },
    {
        desc: 'Multiple pipes',
        input: 'echo "line1\\nline2\\nline3" | grep line | cat',
        expected: /line/
    },
    {
        desc: 'Pipe with &&',
        input: 'echo hello | cat && echo success',
        expected: 'success'
    }
];

testCases.forEach(({ desc, input, expected, expectError }) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${desc}]`);
    console.log(`Input: ${input}`);

    try {
        const result = shell.exec(input);

        if (expectError) {
            console.log(`❌ FAIL: Expected error but got: ${JSON.stringify(result)}`);
        } else if (expected instanceof RegExp) {
            if (expected.test(result)) {
                console.log(`✅ PASS: Output matches pattern`);
                console.log(`Output: ${result}`);
            } else {
                console.log(`❌ FAIL: Output doesn't match pattern`);
                console.log(`Expected pattern: ${expected}`);
                console.log(`Got: ${result}`);
            }
        } else {
            if (result === expected) {
                console.log(`✅ PASS`);
                console.log(`Output: ${result}`);
            } else {
                console.log(`❌ FAIL`);
                console.log(`Expected: ${expected}`);
                console.log(`Got: ${result}`);
            }
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

console.log('\n' + '='.repeat(60));
console.log('Testing complete!');
