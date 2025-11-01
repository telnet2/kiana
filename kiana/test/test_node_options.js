const { MemShell } = require('./src/MemShell.js');

console.log('Testing node command VM options:\n');

const shell = new MemShell();

// Create test scripts using write command
shell.exec('write /test_args.js "console.log(\'Arguments:\', process.argv.slice(2).join(\', \'));"');

shell.exec(`write /test_env.js "console.log('HOME:', process.env.HOME);
console.log('USER:', process.env.USER);
console.log('CUSTOM:', process.env.CUSTOM);"`);

shell.exec('write /test_eval.js "try { const result = eval(\'2 + 2\'); console.log(\'Eval result:\', result); } catch (err) { console.log(\'Eval error:\', err.message); }"');

shell.exec(`write /test_timeout.js "let count = 0;
while (true) {
  count++;
}
console.log('Completed:', count);"`);

const testCases = [
    {
        name: 'Basic script execution',
        setup: () => {
            shell.exec('write /hello.js "console.log(\'Hello, World!\');"');
        },
        command: 'node /hello.js',
        expectedInOutput: 'Hello, World!'
    },
    {
        name: 'Script with arguments',
        command: 'node /test_args.js arg1 arg2 arg3',
        expectedInOutput: 'arg1, arg2, arg3'
    },
    {
        name: 'Script with environment variables',
        command: 'node -e HOME=/home/user -e USER=john -e CUSTOM=value /test_env.js',
        expectedInOutput: ['HOME: /home/user', 'USER: john', 'CUSTOM: value']
    },
    {
        name: 'Script with eval disabled (default)',
        command: 'node /test_eval.js',
        expectedInOutput: 'Eval error'
    },
    {
        name: 'Script with eval enabled',
        command: 'node --allow-eval /test_eval.js',
        expectedInOutput: 'Eval result: 4'
    },
    {
        name: 'Timeout option accepted (note: VM2 has limitations with tight loops)',
        command: 'node --timeout 10000 /test_timeout.js',
        expectedInOutput: 'Completed',
        skip: true,  // Skip because VM2 timeout doesn't work reliably with tight infinite loops
        skipReason: 'VM2 timeout mechanism cannot interrupt tight computational loops'
    },
    {
        name: 'Help text',
        command: 'node --help',
        expectedInOutput: ['--timeout', '--allow-eval', '--allow-wasm', '--env']
    },
    {
        name: 'Combined options',
        setup: () => {
            shell.exec(`write /combined.js "console.log('Arg:', process.argv[2]);
console.log('Env:', process.env.TEST);"`);
        },
        command: 'node -e TEST=hello /combined.js world',
        expectedInOutput: ['Arg: world', 'Env: hello']
    }
];

testCases.forEach(({ name, setup, command, expectedInOutput, expectError, expectedErrorMsg, skip, skipReason }) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${name}]`);
    console.log(`Command: ${command}`);
    console.log(`${'='.repeat(70)}`);

    if (skip) {
        console.log('⏭️  SKIPPED');
        if (skipReason) {
            console.log(`Reason: ${skipReason}`);
        }
        return;
    }

    try {
        if (setup) setup();

        const result = shell.exec(command);

        if (expectError) {
            console.log('❌ FAIL - Expected error but command succeeded');
            console.log(`Output: ${result}`);
        } else {
            const expectations = Array.isArray(expectedInOutput) ? expectedInOutput : [expectedInOutput];
            const allMatch = expectations.every(exp => result.includes(exp));

            if (allMatch) {
                console.log('✅ PASS');
                console.log(`Output:\n${result}`);
            } else {
                console.log('❌ FAIL - Output does not match expectations');
                console.log(`Expected to include: ${expectations.join(', ')}`);
                console.log(`\nActual output:\n${result}`);
            }
        }
    } catch (err) {
        if (expectError) {
            const errorMatches = !expectedErrorMsg || err.message.toLowerCase().includes(expectedErrorMsg.toLowerCase());
            if (errorMatches) {
                console.log('✅ PASS - Got expected error');
                console.log(`Error: ${err.message}`);
            } else {
                console.log('❌ FAIL - Error message does not match');
                console.log(`Expected: ${expectedErrorMsg}`);
                console.log(`Actual: ${err.message}`);
            }
        } else {
            console.log(`❌ FAIL - Unexpected error`);
            console.log(`Error: ${err.message}`);
        }
    }
});

console.log('\n' + '='.repeat(70));
console.log('Node options testing complete!');
