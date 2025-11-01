const { tokenize, parsePipeline, parseRedirections } = require('./src/CommandParser.js');

console.log('Testing CommandParser edge cases:\n');

const testCases = [
    // Basic cases (should work)
    { input: 'echo hello world', desc: 'Basic command' },
    { input: 'cat file.txt | grep test', desc: 'Simple pipe' },
    { input: 'echo "hello world"', desc: 'Double quotes' },
    { input: "echo 'hello world'", desc: 'Single quotes' },

    // Edge cases that might fail
    { input: 'echo "hello\'world"', desc: 'Mixed quotes' },
    { input: "echo 'can'\\''t'", desc: 'Escaped single quote in single quotes' },
    { input: 'echo "hello$world"', desc: 'Dollar sign in double quotes' },
    { input: 'echo $VAR', desc: 'Variable expansion (not supported)' },
    { input: 'echo $(date)', desc: 'Command substitution (not supported)' },
    { input: 'ls *.js', desc: 'Glob pattern (not supported)' },
    { input: 'echo hello && echo world', desc: 'AND operator (not supported)' },
    { input: 'echo hello || echo world', desc: 'OR operator (not supported)' },
    { input: 'cmd1 2>&1 | cmd2', desc: 'Stderr to stdout redirect with pipe' },
    { input: 'echo test &', desc: 'Background process (not supported)' },
    { input: 'echo "line1\\nline2"', desc: 'Escaped newline in quotes' },
    { input: 'echo ~/Documents', desc: 'Tilde expansion (not supported)' },
    { input: 'echo test; echo test2', desc: 'Command separator (not supported)' },
    { input: 'echo "a  b  c"', desc: 'Multiple spaces preserved in quotes' },
    { input: 'echo a\\ b', desc: 'Escaped space' },
    { input: 'cat <(echo test)', desc: 'Process substitution (not supported)' },
    { input: 'echo {1..3}', desc: 'Brace expansion (not supported)' },
];

testCases.forEach(({ input, desc }) => {
    console.log(`\n[${desc}]`);
    console.log(`Input: ${input}`);
    try {
        const tokens = tokenize(input);
        console.log(`Tokens: ${JSON.stringify(tokens)}`);

        const pipeline = parsePipeline(input);
        console.log(`Pipeline: ${JSON.stringify(pipeline)}`);

        if (pipeline.length > 0) {
            const { command, redirections } = parseRedirections(pipeline[0]);
            console.log(`Command: ${JSON.stringify(command)}`);
            console.log(`Redirections: ${JSON.stringify(redirections)}`);
        }
    } catch (err) {
        console.log(`ERROR: ${err.message}`);
    }
});
