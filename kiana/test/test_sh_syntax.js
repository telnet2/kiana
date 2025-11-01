const { parse } = require('sh-syntax');

async function testShSyntax() {
    console.log('Testing sh-syntax AST parsing:\n');

    const testCases = [
        'echo hello world',
        'cat file.txt | grep test',
        'ls -la > output.txt',
        'echo test && echo test2',
        'echo test || echo fallback',
        'cmd1 2>&1 | cmd2',
        'cat << EOF\nline1\nline2\nEOF',
    ];

    for (const input of testCases) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Input: ${input}`);
        console.log('='.repeat(60));

        try {
            const ast = await parse(input);
            console.log('AST:', JSON.stringify(ast, null, 2));
        } catch (err) {
            console.log('ERROR:', err.message);
        }
    }
}

testShSyntax().catch(console.error);
