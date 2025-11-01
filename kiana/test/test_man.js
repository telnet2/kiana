#!/usr/bin/env node
'use strict';

/**
 * Test the man command
 */

const { MemTools } = require('./lib/MemTools');

console.log('Testing man command...\n');
console.log('='.repeat(70));

const memtools = new MemTools();

// Test 1: List all commands
console.log('\n📋 Test 1: man (list all commands)');
console.log('-'.repeat(70));
try {
    const result = memtools.exec('man');
    console.log(result);
} catch (err) {
    console.log('❌ Error:', err.message);
}

// Test 2: man date
console.log('\n📋 Test 2: man date');
console.log('-'.repeat(70));
try {
    const result = memtools.exec('man date');
    console.log(result);
} catch (err) {
    console.log('❌ Error:', err.message);
}

// Test 3: man grep
console.log('\n📋 Test 3: man grep');
console.log('-'.repeat(70));
try {
    const result = memtools.exec('man grep');
    console.log(result);
} catch (err) {
    console.log('❌ Error:', err.message);
}

// Test 4: man kiana
console.log('\n📋 Test 4: man kiana');
console.log('-'.repeat(70));
try {
    const result = memtools.exec('man kiana');
    console.log(result);
} catch (err) {
    console.log('❌ Error:', err.message);
}

// Test 5: man --help
console.log('\n📋 Test 5: man --help');
console.log('-'.repeat(70));
try {
    const result = memtools.exec('man --help');
    console.log(result);
} catch (err) {
    console.log('❌ Error:', err.message);
}

// Test 6: man nonexistent
console.log('\n📋 Test 6: man nonexistent');
console.log('-'.repeat(70));
try {
    const result = memtools.exec('man nonexistent');
    console.log(result);
} catch (err) {
    console.log('❌ Error:', err.message);
}

// Test 7: man ls
console.log('\n📋 Test 7: man ls');
console.log('-'.repeat(70));
try {
    const result = memtools.exec('man ls');
    console.log(result);
} catch (err) {
    console.log('❌ Error:', err.message);
}

console.log('\n' + '='.repeat(70));
console.log('✓ All man command tests completed');
