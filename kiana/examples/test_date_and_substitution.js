#!/usr/bin/env node
'use strict';

/**
 * Test date command and command substitution $(xxx)
 */

const { MemTools } = require('./lib/MemTools');

function main() {
    const memtools = new MemTools();

    console.log('=== Testing date command ===\n');

    // Test 1: Basic date command
    console.log('1. Basic date command:');
    console.log(memtools.exec('date'));
    console.log('');

    // Test 2: ISO format
    console.log('2. ISO-8601 format:');
    console.log(memtools.exec('date --iso-8601'));
    console.log('');

    // Test 3: Custom format
    console.log('3. Custom format (+%Y-%m-%d %H:%M:%S):');
    console.log(memtools.exec('date +%Y-%m-%d\\ %H:%M:%S'));
    console.log('');

    console.log('=== Testing command substitution $(xxx) ===\n');

    // Test 4: Simple command substitution
    console.log('4. Simple substitution echo $(date):');
    console.log(memtools.exec('echo $(date)'));
    console.log('');

    // Test 5: Command substitution in file redirect
    console.log('5. Command substitution with file redirect:');
    memtools.exec('echo Current date: $(date) > info.txt');
    console.log('Contents of info.txt:');
    console.log(memtools.exec('cat info.txt'));
    console.log('');

    // Test 6: Nested command substitution
    console.log('6. Nested substitution echo $(echo $(date)):');
    console.log(memtools.exec('echo $(echo $(date))'));
    console.log('');

    // Test 7: Multiple substitutions
    console.log('7. Multiple substitutions in one line:');
    console.log(memtools.exec('echo Date: $(date +%Y-%m-%d) Time: $(date +%H:%M:%S)'));
    console.log('');

    // Test 8: Command substitution with pwd
    console.log('8. Using pwd in substitution:');
    memtools.exec('mkdir -p /test/dir');
    memtools.exec('cd /test/dir');
    console.log(memtools.exec('echo Current directory is $(pwd)'));
    console.log('');

    // Test 9: Command substitution with ls
    console.log('9. Using ls in substitution:');
    memtools.exec('cd /');
    memtools.exec('touch file1.txt file2.txt');
    console.log(memtools.exec('echo Files: $(ls)'));
    console.log('');

    console.log('=== All tests completed successfully! ===');
}

if (require.main === module) {
    main();
}

module.exports = { main };
