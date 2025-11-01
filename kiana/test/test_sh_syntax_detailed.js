const { parse } = require('sh-syntax');

async function testDetailed() {
    const input = 'echo hello | grep h';

    console.log('Input:', input);
    console.log('\n');

    const ast = await parse(input);

    // Function to explore all properties of an object
    function exploreObject(obj, prefix = '', seen = new Set()) {
        if (obj === null || obj === undefined) return;
        if (typeof obj !== 'object') return;
        if (seen.has(obj)) return; // Avoid circular refs

        seen.add(obj);

        for (const key of Object.keys(obj)) {
            const value = obj[key];
            const fullKey = prefix ? `${prefix}.${key}` : key;

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                console.log(`${fullKey}:`, typeof value);
                exploreObject(value, fullKey, seen);
            } else if (Array.isArray(value)) {
                console.log(`${fullKey}: Array[${value.length}]`);
                value.forEach((item, idx) => {
                    exploreObject(item, `${fullKey}[${idx}]`, seen);
                });
            } else {
                console.log(`${fullKey}:`, JSON.stringify(value));
            }
        }
    }

    console.log('Full AST structure:');
    exploreObject(ast);

    console.log('\n\nStmt[0].Cmd:', ast.Stmt[0].Cmd);

    // Try to extract text from positions
    const stmt = ast.Stmt[0];
    const cmdPos = stmt.Cmd.Pos;
    const cmdEnd = stmt.Cmd.End;

    console.log(`\nCommand at positions ${cmdPos.Offset}-${cmdEnd.Offset}:`);
    console.log(input.substring(cmdPos.Offset, cmdEnd.Offset));
}

testDetailed().catch(console.error);
