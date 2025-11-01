const { MemShell } = require('./src/MemShell.js');

console.log('Testing Enhanced Grep with POSIX flags:\n');

const shell = new MemShell();

// Create test files
shell.exec('mkdir /testdir');

// Create sample.txt using cat with HEREDOC
shell.exec(`cat << EOF > /testdir/sample.txt
Line 1: The quick brown fox
Line 2: jumps over the lazy dog
Line 3: The dog barks loudly
Line 4: while the cat sleeps
Line 5: The fox runs away
Line 6: into the forest
Line 7: where birds sing
Line 8: The END of story
EOF`);

// Create log.txt
shell.exec(`cat << EOF > /testdir/log.txt
ERROR: Connection failed
INFO: Starting server
WARNING: Low memory
ERROR: Database timeout
INFO: Server running
DEBUG: Processing request
ERROR: File not found
EOF`);

// Create animals.txt
shell.exec(`cat << EOF > /testdir/animals.txt
cat
dog
bird
fish
EOF`);

const testCases = [
    {
        name: 'Basic pattern search',
        command: 'grep fox /testdir/sample.txt',
        desc: 'Find lines with "fox"'
    },
    {
        name: 'Case insensitive (-i)',
        command: 'grep -i THE /testdir/sample.txt',
        desc: 'Find "the" case-insensitive'
    },
    {
        name: 'Line numbers (-n)',
        command: 'grep -n dog /testdir/sample.txt',
        desc: 'Show line numbers'
    },
    {
        name: 'After context (-A)',
        command: 'grep -A 2 fox /testdir/sample.txt',
        desc: 'Show 2 lines after match'
    },
    {
        name: 'Before context (-B)',
        command: 'grep -B 2 fox /testdir/sample.txt',
        desc: 'Show 2 lines before match'
    },
    {
        name: 'After context with line numbers (-A -n)',
        command: 'grep -n -A 1 dog /testdir/sample.txt',
        desc: 'Line numbers with context'
    },
    {
        name: 'Multiple patterns (-e)',
        command: 'grep -e cat -e dog /testdir/sample.txt',
        desc: 'Match either "cat" or "dog"'
    },
    {
        name: 'Multiple -e flags',
        command: 'grep -e ERROR -e WARNING /testdir/log.txt',
        desc: 'Match ERROR or WARNING'
    },
    {
        name: 'Multiple files without -h',
        command: 'grep dog /testdir/sample.txt /testdir/animals.txt',
        desc: 'Show filenames (default with multiple files)'
    },
    {
        name: 'Multiple files with -h',
        command: 'grep -h dog /testdir/sample.txt /testdir/animals.txt',
        desc: 'Suppress filenames with -h'
    },
    {
        name: 'Pipe with grep',
        command: 'cat /testdir/log.txt | grep ERROR',
        desc: 'Grep from stdin'
    },
    {
        name: 'Pipe with -A flag',
        command: 'cat /testdir/sample.txt | grep -A 1 fox',
        desc: 'Grep stdin with context'
    },
    {
        name: 'Combined flags -niA',
        command: 'grep -niA2 error /testdir/log.txt',
        desc: 'Case-insensitive, line numbers, 2 lines after'
    },
    {
        name: 'Attached value -A2',
        command: 'grep -A2 ERROR /testdir/log.txt',
        desc: 'Value attached to flag'
    },
    {
        name: 'Context with separator',
        command: 'grep -A 1 Line /testdir/sample.txt',
        desc: 'Should show -- separator for non-contiguous matches'
    },
    {
        name: 'Multiple patterns with -i',
        command: 'grep -i -e error -e warning /testdir/log.txt',
        desc: 'Case-insensitive OR search'
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
        console.log(result || '(no output)');
    } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
    }
});

console.log('\n' + '='.repeat(70));
console.log('Testing complete!');
