/**
 * Example: Spinner for LLM Response Feedback
 *
 * Demonstrates the spinner showing activity while waiting for LLM response.
 */

const { Spinner, StdoutWriter, SpinnerWriter } = require('../index.js');

console.log('='.repeat(70));
console.log('Spinner Example - Visual Feedback for Async Operations');
console.log('='.repeat(70));

// Example 1: Basic Spinner Usage
console.log('\n1. Basic Spinner');
console.log('-'.repeat(70));

const spinner1 = new Spinner();
console.log('Starting spinner...');
spinner1.start();

setTimeout(() => {
    spinner1.stop();
    console.log('Spinner stopped after 1 second');
}, 1000);

// Example 2: Spinner with Status Checks
setTimeout(() => {
    console.log('\n2. Spinner State Management');
    console.log('-'.repeat(70));

    const spinner2 = new Spinner();

    console.log('Before start:', spinner2.isRunning() ? 'running' : 'stopped');
    spinner2.start();
    console.log('After start: running (⠋ animated)');

    setTimeout(() => {
        spinner2.stop();
        console.log('After stop: stopped');
        console.log('Final state:', spinner2.isRunning() ? 'running' : 'stopped');
    }, 800);
}, 1200);

// Example 3: SpinnerWriter - Automatic Stop on First Output
setTimeout(() => {
    console.log('\n3. SpinnerWriter - Auto-Stop on Output');
    console.log('-'.repeat(70));

    const spinner3 = new Spinner();
    const writer = new StdoutWriter();
    const spinnerWriter = new SpinnerWriter(writer, spinner3);

    console.log('Simulating LLM response with spinner...');
    spinner3.start();

    // Simulate LLM starting to stream after delay
    setTimeout(() => {
        // When first output arrives, SpinnerWriter automatically stops spinner
        spinnerWriter.write('Kiana: ');
        spinnerWriter.write('I\'ve analyzed your request...\n');
        spinnerWriter.writeLine('The solution is straightforward!');

        console.log('\n✓ Spinner automatically stopped when streaming began');
    }, 600);
}, 2200);

// Example 4: Error Handling
setTimeout(() => {
    console.log('\n4. Error Handling with Spinner');
    console.log('-'.repeat(70));

    const spinner4 = new Spinner();
    console.log('Processing request...');
    spinner4.start();

    setTimeout(() => {
        spinner4.stop();
        console.log('✗ Error occurred, spinner cleaned up');
    }, 500);
}, 3200);

// Example 5: Real-World Scenario
setTimeout(() => {
    console.log('\n5. Real-World Scenario - Kiana Interactive Mode');
    console.log('-'.repeat(70));

    console.log(`
Flow in Kiana mode:

  memsh:/\$ kiana
  [Entering Kiana Interactive Mode]
  
  kiana:/\$ Create a TypeScript project
  ⠋ (spinner shows: processing LLM request)
  
  (LLM generates first tool call)
  ⠋ → (spinner stops automatically)
  
  🔧 memfs_exec: mkdir -p /project/src
  ✓ Result: Created directory
  
  Kiana: I've created a TypeScript project with src directory...
  
  kiana:/\$ (prompt reappears after response)
  `);

    console.log('\nBenefits:');
    console.log('✓ User sees immediate visual feedback');
    console.log('✓ Spinner stops automatically when content arrives');
    console.log('✓ No manual spinner management needed');
    console.log('✓ Works in both success and error cases');
    console.log('✓ Minimal performance overhead');
}, 4000);

// Summary
setTimeout(() => {
    console.log('\n' + '='.repeat(70));
    console.log('Spinner Implementation Summary');
    console.log('='.repeat(70));

    console.log(`
FEATURES:
  • Animated spinner with braille characters
  • Automatic state tracking (isRunning)
  • Clean start/stop interface
  • SpinnerWriter wrapper for automatic stopping
  • Error-safe (can stop multiple times safely)

USAGE:
  const spinner = new Spinner();
  
  spinner.start();        // Show spinner
  // ... do work ...
  spinner.stop();         // Hide spinner
  
  // Or with SpinnerWriter:
  const writer = new SpinnerWriter(baseWriter, spinner);
  spinner.start();
  // ... streaming to writer stops spinner automatically ...

PERFORMANCE:
  • Timer-based animation (80ms per frame)
  • Minimal CPU usage
  • Can be stopped at any time
  • Safe for multiple starts/stops

INTEGRATION:
  • Used in MemREPL for Kiana interactive mode
  • Shows while waiting for LLM response
  • Stops automatically on first streaming output
  • Ensures prompt reappears when done
    `);

    console.log('='.repeat(70));
}, 5000);
