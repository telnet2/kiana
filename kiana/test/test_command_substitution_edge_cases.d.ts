#!/usr/bin/env node
/**
 * Edge case tests for command substitution $(...)
 */
declare const MemTools: any;
declare function testCase(name: string, command: string, expectError?: boolean): boolean;
declare function runTests(): boolean;
