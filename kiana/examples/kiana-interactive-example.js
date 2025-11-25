/**
 * Example: Kiana Interactive Mode
 *
 * Demonstrates the interactive conversational AI mode where users can:
 * 1. Enter tasks naturally
 * 2. See tool calls and results streamed in real-time
 * 3. Get LLM responses streamed character by character
 * 4. Switch between shell and Kiana modes
 */

const { MemShell, MemSession, KianaInteractive } = require('../index.js');
const { StdoutWriter } = require('../lib/Writer');

console.log('='.repeat(70));
console.log('Kiana Interactive Mode Example');
console.log('='.repeat(70));

(async () => {
    // Create a session that persists across mode switches
    const session = new MemSession('demo-session');
    const shell = new MemShell(null, session);

    // Setup the shell with some initial state
    shell.exec('mkdir -p /app/src');
    shell.exec('mkdir -p /app/tests');
    shell.session.setEnv('NODE_ENV', 'development');
    shell.session.setCwd('/app');

    console.log('\n1. Initial Session State');
    console.log('-'.repeat(70));
    console.log(`Session ID: ${session.getId()}`);
    console.log(`Working Directory: ${session.getCwd()}`);
    console.log(`Environment: NODE_ENV=${session.getEnv('NODE_ENV')}`);

    // Create a Kiana instance for interactive mode
    const kiana = new KianaInteractive(shell, {
        writer: new StdoutWriter(),
        model: 'gpt-4o-mini',
        maxRounds: 5,
    });

    console.log('\n2. Kiana Interactive Mode');
    console.log('-'.repeat(70));
    console.log(`Prompt: ${kiana.getPrompt()}`);
    console.log('Is Active:', kiana.isActive());

    console.log('\n3. Example: Sending a Message');
    console.log('-'.repeat(70));
    console.log('User: Create a simple Node.js app with a main file');
    console.log('\nKiana Response:');

    try {
        // This would normally be called from the REPL when user types a message
        // For demonstration, we're simulating it
        console.log('(Streaming response would appear here in interactive mode)');
        console.log('(In real use, tool calls and LLM responses stream to terminal)\n');

        // Show what the session would track
        console.log('Session would record:');
        console.log(`  - Message: "Create a simple Node.js app with a main file"`);
        console.log(`  - Tool calls executed`);
        console.log(`  - LLM response streamed`);
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }

    console.log('\n4. Mode Switching Example');
    console.log('-'.repeat(70));
    console.log('Shell Mode:  memsh:/app$');
    console.log('Kiana Mode:  kiana:/app>');
    console.log('\nTransitions:');
    console.log('  memsh$ kiana        → Enter Kiana mode');
    console.log('  kiana$ /exit        → Return to shell');

    console.log('\n5. Session Persistence');
    console.log('-'.repeat(70));
    const info = session.getInfo();
    console.log(`Session Info:`);
    console.log(`  ID: ${info.id}`);
    console.log(`  Created: ${info.createdAt.toISOString()}`);
    console.log(`  Working Directory: ${info.cwd}`);
    console.log(`  Environment Variables: ${info.envVarCount}`);

    console.log('\n6. Use Cases');
    console.log('-'.repeat(70));
    console.log(`
User can naturally request tasks:
  "Create a React app with TypeScript"
  → Kiana creates directories, generates files, sets up configs
  → Shows tool calls: "🔧 mkdir src", "✓ Created"
  → Streams response: "I've set up your React app..."

  "Add error handling to the API"
  → Kiana reads existing files, suggests improvements
  → Shows: "🔧 cat src/api.js", "✓ Read 245 bytes"
  → Streams: "I've added comprehensive error handling..."

  "Run tests and fix any failures"
  → Kiana runs commands, sees failures, fixes issues
  → Shows: "🔧 npm test", "✗ 3 failures"
  → Then: "🔧 cat src/error.js", "✓ Updated"
  → Streams: "Fixed the 3 failing tests by..."
    `);

    console.log('\n7. Architecture Benefits');
    console.log('-'.repeat(70));
    console.log(`
✓ Unified Session State
  - Command history tracked across modes
  - Environment variables persist
  - Working directory shared

✓ Streaming Output
  - Tool calls show in real-time
  - LLM response streams progressively
  - No waiting for full response

✓ Extensibility
  - Writer interface allows different backends
  - SSEWriter for web app support
  - Session can be serialized for persistence

✓ Mode Flexibility
  - Users can switch between CLI and conversational
  - Complex tasks in Kiana, quick commands in shell
  - Same filesystem and session throughout
    `);

    console.log('\n' + '='.repeat(70));
    console.log('Interactive mode ready for user interaction!');
    console.log('Run "memsh" to start the shell and type "kiana" to enter');
    console.log('='.repeat(70) + '\n');
})();
