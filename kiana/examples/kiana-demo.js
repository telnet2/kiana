#!/usr/bin/env node
'use strict';

/**
 * Demo: Kiana LLM Agent
 *
 * Demonstrates using the kiana command to create an autonomous agent
 * that can execute shell commands in the in-memory filesystem.
 *
 * Requirements:
 *   OPENAI_API_KEY=sk-xxx node examples/kiana-demo.js
 */

// Load environment variables from .env file if it exists
require('dotenv').config();

const { MemTools } = require('../lib/MemTools');

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY must be set in the environment.');
    }

    const memtools = new MemTools();

    console.log('=== Kiana Demo: Simple File Creation ===\n');

    // Create an instruction file in MemFS
    memtools.exec(`cat > task.txt << 'EOF'
Create a file named hello.txt with the content "Hello from Kiana!".
Then create a file named info.txt listing the current date and time.
Finally, use ls to show all files in the current directory.
EOF`);

    console.log('Instruction file created in MemFS.');
    console.log('Task:', memtools.exec('cat task.txt'));
    console.log('');

    // Run kiana with the instruction file
    console.log('Running kiana agent...\n');
    console.log('─'.repeat(70));

    const result = memtools.exec('kiana --instruction task.txt');

    console.log('─'.repeat(70));
    console.log('\nKiana completed!');
    console.log('Final message:', result);
    console.log('');

    // Verify the files were created
    console.log('=== Verification ===');
    console.log('Files in MemFS:');
    console.log(memtools.exec('ls'));
    console.log('');

    try {
        console.log('Contents of hello.txt:');
        console.log(memtools.exec('cat hello.txt'));
        console.log('');
    } catch (err) {
        console.log('hello.txt not found:', err.message);
    }

    try {
        console.log('Contents of info.txt:');
        console.log(memtools.exec('cat info.txt'));
        console.log('');
    } catch (err) {
        console.log('info.txt not found:', err.message);
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Error:', err.message);
        process.exit(1);
    });
}

module.exports = { main };
