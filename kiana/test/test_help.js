const { MemShell } = require('./src/MemShell.js');

console.log('Testing --help for all commands:\n');

const shell = new MemShell();

const commands = [
    'ls --help',
    'ls -h',
    'cat --help',
    'mkdir --help',
    'touch --help',
    'rm --help',
    'diff --help',
    'grep --help',
    'find --help',
    'sed --help',
    'patch --help',
    'import --help',
    'export --help',
    'node --help',
    'write --help'
];

commands.forEach(cmd => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Command: ${cmd}`);
    console.log('='.repeat(70));

    try {
        const result = shell.exec(cmd);
        console.log(result);
    } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
    }
});

console.log('\n' + '='.repeat(70));
console.log('Help testing complete!');
