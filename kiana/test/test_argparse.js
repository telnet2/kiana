const { ArgumentParser } = require('argparse');

console.log('Testing argparse API:\n');

// Test 1: Basic parser
console.log('=== Test 1: Basic parser ===');
const parser1 = new ArgumentParser({
    description: 'Test parser',
    add_help: false // Don't add -h automatically
});

parser1.add_argument('-i', '--ignore-case', { action: 'store_true', help: 'Case insensitive' });
parser1.add_argument('-n', '--line-number', { action: 'store_true', help: 'Show line numbers' });
parser1.add_argument('pattern', { help: 'Pattern to search' });
parser1.add_argument('files', { nargs: '*', help: 'Files to search' });

// Parse custom args (not process.argv)
const args1 = parser1.parse_args(['-i', '-n', 'hello', 'file1.txt', 'file2.txt']);
console.log('Parsed:', args1);

// Test 2: Flags with values
console.log('\n=== Test 2: Flags with values ===');
const parser2 = new ArgumentParser({ add_help: false });
parser2.add_argument('-A', '--after-context', { type: 'int', default: 0, help: 'Lines after' });
parser2.add_argument('-B', '--before-context', { type: 'int', default: 0, help: 'Lines before' });
parser2.add_argument('pattern');
parser2.add_argument('files', { nargs: '*' });

const args2 = parser2.parse_args(['-A', '2', '-B', '1', 'pattern', 'file.txt']);
console.log('Parsed:', args2);

// Test 3: Multiple -e flags
console.log('\n=== Test 3: Multiple -e flags (append) ===');
const parser3 = new ArgumentParser({ add_help: false });
parser3.add_argument('-e', '--regexp', { action: 'append', dest: 'patterns', help: 'Pattern' });
parser3.add_argument('-i', { action: 'store_true' });
parser3.add_argument('files', { nargs: '*' });

const args3 = parser3.parse_args(['-e', 'error', '-e', 'warning', '-i', 'log.txt']);
console.log('Parsed:', args3);

// Test 4: Pattern from positional if -e not used
console.log('\n=== Test 4: Positional pattern ===');
const parser4 = new ArgumentParser({ add_help: false });
parser4.add_argument('-e', '--regexp', { action: 'append', dest: 'patterns', help: 'Pattern' });
parser4.add_argument('rest', { nargs: '*' }); // Collect everything else

const args4a = parser4.parse_args(['pattern', 'file1.txt', 'file2.txt']);
console.log('Without -e:', args4a);

const args4b = parser4.parse_args(['-e', 'pat1', '-e', 'pat2', 'file1.txt']);
console.log('With -e:', args4b);

// Test 5: Short flags combined
console.log('\n=== Test 5: Combined short flags ===');
const parser5 = new ArgumentParser({ add_help: false });
parser5.add_argument('-n', { action: 'store_true' });
parser5.add_argument('-i', { action: 'store_true' });
parser5.add_argument('-h', '--no-filename', { action: 'store_true' });
parser5.add_argument('-A', { type: 'int', default: 0 });
parser5.add_argument('pattern');

try {
    const args5 = parser5.parse_args(['-niA2', 'pattern']);
    console.log('Parsed:', args5);
} catch (err) {
    console.log('Error (expected - argparse may not support this):', err.message);
}

// Test 6: Error handling
console.log('\n=== Test 6: Error handling ===');
const parser6 = new ArgumentParser({
    add_help: false,
    exit_on_error: false // Don't exit on error
});
parser6.add_argument('required_arg');

try {
    parser6.parse_args([]);
} catch (err) {
    console.log('Caught error:', err.message);
}

console.log('\n=== All tests complete ===');
