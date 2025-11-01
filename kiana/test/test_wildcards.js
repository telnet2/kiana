const { MemShell } = require('./src/MemShell.js');

console.log('Testing wildcard support:\n');

const shell = new MemShell();

// Create test files
shell.exec('touch /file1.txt');
shell.exec('touch /file2.txt');
shell.exec('touch /file3.json');
shell.exec('touch /file4.json');
shell.exec('touch /README.md');
shell.exec('mkdir /src');
shell.exec('touch /src/index.js');
shell.exec('touch /src/test.js');
shell.exec('touch /src/data.json');

// Add content to some files
shell.exec('write /file1.txt "hello from file1"');
shell.exec('write /file2.txt "world from file2"');
shell.exec('write /file3.json "{\\"key\\": \\"value1\\"}"');
shell.exec('write /file4.json "{\\"key\\": \\"value2\\"}"');
shell.exec('write /src/index.js "console.log(hello);"');
shell.exec('write /src/test.js "console.log(world);"');

const testCases = [
    {
        name: 'ls *.txt',
        command: 'ls *.txt',
        desc: 'List all .txt files in root'
    },
    {
        name: 'ls *.json',
        command: 'ls *.json',
        desc: 'List all .json files in root'
    },
    {
        name: 'ls file*',
        command: 'ls file*',
        desc: 'List all files starting with "file"'
    },
    {
        name: 'ls *.md',
        command: 'ls *.md',
        desc: 'List all .md files'
    },
    {
        name: 'cat *.txt',
        command: 'cat *.txt',
        desc: 'Concatenate all .txt files'
    },
    {
        name: 'cat *.json',
        command: 'cat *.json',
        desc: 'Concatenate all .json files'
    },
    {
        name: 'grep hello *.txt',
        command: 'grep hello *.txt',
        desc: 'Search for "hello" in all .txt files'
    },
    {
        name: 'grep key *.json',
        command: 'grep key *.json',
        desc: 'Search for "key" in all .json files'
    },
    {
        name: 'grep console /src/*.js',
        command: 'grep console /src/*.js',
        desc: 'Search for "console" in all .js files in /src'
    },
    {
        name: 'ls /src/*.js',
        command: 'ls /src/*.js',
        desc: 'List all .js files in /src directory'
    },
    {
        name: 'rm *.json (verify not executed)',
        setup: () => {
            // Just verify the files exist before running rm test
            const before = shell.exec('ls /');
            return before.includes('file3.json') && before.includes('file4.json');
        },
        command: 'ls *.json',
        desc: 'Verify .json files still exist (not actually removing)'
    },
    {
        name: 'No matches for pattern',
        command: 'ls *.xyz',
        desc: 'Pattern with no matches should keep original pattern'
    }
];

testCases.forEach(({ name, setup, command, desc }) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${name}]`);
    console.log(`Description: ${desc}`);
    console.log(`Command: ${command}`);
    console.log(`${'='.repeat(70)}`);

    try {
        if (setup) {
            const setupResult = setup();
            if (!setupResult) {
                console.log('❌ Setup verification failed');
                return;
            }
        }

        const result = shell.exec(command);
        console.log('✅ SUCCESS');
        console.log(`Output:\n${result || '(no output)'}`);
    } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
    }
});

console.log('\n' + '='.repeat(70));
console.log('Wildcard testing complete!');
