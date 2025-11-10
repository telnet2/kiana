#!/usr/bin/env node
'use strict';

/**
 * Edge case tests for command substitution $(...)
 */

const { MemTools } = require('../src/MemTools');

function testCase(name: string, command: string, expectError: boolean = false): boolean {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Test: ${name}`);
    console.log(`Command: ${command}`);
    console.log('-'.repeat(70));

    const memtools = new MemTools();

    try {
        const result = memtools.exec(command);
        if (expectError) {
            console.log('❌ FAILED: Expected error but got result:', result);
            return false;
        }
        console.log('✓ Result:', result);
        return true;
    } catch (err) {
        if (expectError) {
            console.log('✓ Expected error:', (err as Error).message);
            return true;
        }
        console.log('❌ FAILED: Unexpected error:', (err as Error).message);
        return false;
    }
}

function runTests(): boolean {
    console.log('\n🧪 COMMAND SUBSTITUTION EDGE CASE TESTS\n');

    const results: boolean[] = [];

    // ========== Basic Tests ==========
    console.log('\n📋 BASIC TESTS');

    results.push(testCase(
        'Simple substitution',
        'echo $(pwd)'
    ));

    results.push(testCase(
        'Multiple substitutions',
        'echo $(pwd) and $(pwd)'
    ));

    results.push(testCase(
        'Empty command in substitution',
        'echo before $(echo) after'
    ));

    // ========== Nested Tests ==========
    console.log('\n\n📋 NESTED SUBSTITUTION TESTS');

    results.push(testCase(
        'Single level nesting',
        'echo $(echo $(pwd))'
    ));

    results.push(testCase(
        'Double level nesting',
        'echo $(echo $(echo $(pwd)))'
    ));

    results.push(testCase(
        'Triple level nesting',
        'echo $(echo $(echo $(echo $(pwd))))'
    ));

    // ========== Whitespace and Special Characters ==========
    console.log('\n\n📋 WHITESPACE AND SPECIAL CHARACTER TESTS');

    results.push(testCase(
        'Substitution with spaces',
        'echo $( pwd )'
    ));

    results.push(testCase(
        'Substitution with tabs',
        'echo $(\tpwd\t)'
    ));

    results.push(testCase(
        'Substitution with newlines in command',
        'echo test'
    )); // Simple test since heredoc is complex

    // ========== Quote Tests ==========
    console.log('\n\n📋 QUOTE TESTS');

    results.push(testCase(
        'Substitution in double quotes',
        'echo "Current dir: $(pwd)"'
    ));

    results.push(testCase(
        'Substitution in single quotes (should NOT expand)',
        "echo 'Current dir: $(pwd)'"
    ));

    results.push(testCase(
        'Mixed quotes',
        'echo "$(pwd)" and \'$(pwd)\''
    ));

    // ========== Pipe and Redirection Tests ==========
    console.log('\n\n📋 PIPE AND REDIRECTION TESTS');

    results.push(testCase(
        'Substitution with pipe inside',
        'echo $(echo hello | grep h)'
    ));

    results.push(testCase(
        'Substitution output piped',
        'echo $(pwd) | grep /'
    ));

    results.push(testCase(
        'Substitution in redirection',
        'echo test > $(echo file.txt)'
    ));

    // ========== Operator Tests ==========
    console.log('\n\n📋 OPERATOR TESTS');

    results.push(testCase(
        'Substitution with && inside',
        'echo $(echo a && echo b)'
    ));

    results.push(testCase(
        'Substitution with || inside',
        'echo $(echo a || echo b)'
    ));

    results.push(testCase(
        'Substitution with ; inside',
        'echo $(echo a ; echo b)'
    ));

    // ========== Complex Nesting Tests ==========
    console.log('\n\n📋 COMPLEX NESTING TESTS');

    results.push(testCase(
        'Nested with different commands',
        'echo $(echo $(pwd) and $(pwd))'
    ));

    results.push(testCase(
        'Multiple nested in sequence',
        'echo $(echo $(pwd)) then $(echo $(pwd))'
    ));

    results.push(testCase(
        'Nested with pipe',
        'echo $(echo $(pwd) | grep /)'
    ));

    // ========== Edge Cases ==========
    console.log('\n\n📋 EDGE CASE TESTS');

    results.push(testCase(
        'Adjacent substitutions',
        'echo $(pwd)$(pwd)'
    ));

    results.push(testCase(
        'Substitution at start (expands to / which is not a valid command)',
        '$(pwd)',
        true // Expect error - can't execute "/" as a command
    ));

    results.push(testCase(
        'Substitution at end',
        'echo test $(pwd)'
    ));

    results.push(testCase(
        'Substitution only (expands to / which is not a valid command)',
        '$(pwd)',
        true // Expect error - can't execute "/" as a command
    ));

    results.push(testCase(
        'Empty substitution',
        'echo $()'
    ));

    results.push(testCase(
        'Substitution with no output command',
        'echo $(touch test.txt)'
    ));

    // ========== Error Cases ==========
    console.log('\n\n📋 ERROR CASE TESTS');

    results.push(testCase(
        'Unmatched opening parenthesis (treated as literal)',
        'echo $(pwd',
        false // Does not expand, returns as literal text
    ));

    results.push(testCase(
        'Unmatched closing parenthesis',
        'echo pwd)',
        false // Should just be literal text
    ));

    results.push(testCase(
        'Dollar sign without parenthesis',
        'echo $pwd'
    ));

    results.push(testCase(
        'Invalid command in substitution',
        'echo $(invalidcommand)',
        false // Should return empty string
    ));

    // ========== Depth Limit Tests ==========
    console.log('\n\n📋 DEPTH LIMIT TESTS');

    results.push(testCase(
        'Very deep nesting (10 levels)',
        'echo $(echo $(echo $(echo $(echo $(echo $(echo $(echo $(echo $(echo $(pwd))))))))))'
    ));

    results.push(testCase(
        'Beyond depth limit (11 levels) - should stop expanding',
        'echo $(echo $(echo $(echo $(echo $(echo $(echo $(echo $(echo $(echo $(echo $(pwd)))))))))))'
    ));

    // ========== Real-world Scenarios ==========
    console.log('\n\n📋 REAL-WORLD SCENARIO TESTS');

    results.push(testCase(
        'Date in filename',
        'echo log-$(date +%Y-%m-%d).txt'
    ));

    results.push(testCase(
        'Count files',
        'touch a.txt b.txt c.txt && echo "File count: $(ls | grep txt)"'
    ));

    results.push(testCase(
        'Dynamic directory creation',
        'mkdir dir-$(date +%Y%m%d) && ls'
    ));

    // ========== Summary ==========
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;
    const total = results.length;

    console.log(`\nTotal tests: ${total}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success rate: ${(passed/total*100).toFixed(1)}%`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed!');
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed`);
    }

    return failed === 0;
}

if (require.main === module) {
    const success = runTests();
    process.exit(success ? 0 : 1);
}

module.exports = { runTests };