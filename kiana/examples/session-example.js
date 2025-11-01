/**
 * Example: MemShell Session Management
 *
 * Demonstrates how MemShell manages sessions with:
 * - Command history tracking
 * - Environment variables
 * - Working directory persistence
 * - Session sharing between shells
 */

const { MemShell, MemSession, MemFS } = require('../index.js');

console.log('='.repeat(60));
console.log('MemShell Session Management Example');
console.log('='.repeat(60));

// Example 1: Basic Session Usage
console.log('\n1. Basic Session Usage');
console.log('-'.repeat(60));

const shell = new MemShell();
console.log(`Created session: ${shell.session.getId()}`);
console.log(`Session info: ${JSON.stringify(shell.session.getInfo(), null, 2)}`);

// Execute some commands
console.log('\nExecuting commands...');
shell.exec('mkdir -p /home/user/projects');
shell.exec('cd /home/user');

// Track commands in session
shell.session.addCommand('mkdir -p /home/user/projects');
shell.session.addCommand('cd /home/user');

console.log(`History: ${shell.session.getHistory().join(' -> ')}`);
console.log(`History size: ${shell.session.getHistory().length}`);

// Example 2: Environment Variables in Session
console.log('\n2. Environment Variables');
console.log('-'.repeat(60));

shell.session.setEnv('APP_NAME', 'MyApp');
shell.session.setEnv('VERSION', '1.0.0');
shell.session.setEnv('DEBUG', 'true');

console.log('Set environment variables:');
console.log(`  APP_NAME: ${shell.session.getEnv('APP_NAME')}`);
console.log(`  VERSION: ${shell.session.getEnv('VERSION')}`);
console.log(`  DEBUG: ${shell.session.getEnv('DEBUG')}`);

// Example 3: Working Directory Tracking
console.log('\n3. Working Directory Management');
console.log('-'.repeat(60));

shell.session.setCwd('/home/user/projects');
console.log(`Current working directory: ${shell.session.getCwd()}`);

shell.session.setCwd('/home/user/projects/app');
console.log(`Changed to: ${shell.session.getCwd()}`);

// Example 4: Creating Named Sessions
console.log('\n4. Named Sessions');
console.log('-'.repeat(60));

const devSession = new MemSession('dev-session');
const prodSession = new MemSession('prod-session');

const devShell = new MemShell(null, devSession);
const prodShell = new MemShell(null, prodSession);

devShell.session.setEnv('ENV', 'development');
devShell.session.setEnv('DEBUG', 'true');
devShell.session.setEnv('LOG_LEVEL', 'debug');

prodShell.session.setEnv('ENV', 'production');
prodShell.session.setEnv('DEBUG', 'false');
prodShell.session.setEnv('LOG_LEVEL', 'error');

console.log('Dev Session:');
console.log(`  ENV: ${devShell.session.getEnv('ENV')}`);
console.log(`  DEBUG: ${devShell.session.getEnv('DEBUG')}`);

console.log('Prod Session:');
console.log(`  ENV: ${prodShell.session.getEnv('ENV')}`);
console.log(`  DEBUG: ${prodShell.session.getEnv('DEBUG')}`);

// Example 5: Shared Sessions Between Shells
console.log('\n5. Shared Session Between Multiple Shells');
console.log('-'.repeat(60));

const sharedSession = new MemSession('shared-workspace');
const shell1 = new MemShell(null, sharedSession);
const shell2 = new MemShell(null, sharedSession);

shell1.session.addCommand('echo "Command from shell 1"');
shell1.session.setEnv('SHARED_VAR', 'value_from_shell1');

console.log('Shell 1 set:');
console.log(`  History: ${shell1.session.getHistory()}`);
console.log(`  SHARED_VAR: ${shell1.session.getEnv('SHARED_VAR')}`);

console.log('Shell 2 sees (same session):');
console.log(`  History: ${shell2.session.getHistory()}`);
console.log(`  SHARED_VAR: ${shell2.session.getEnv('SHARED_VAR')}`);

shell2.session.addCommand('echo "Command from shell 2"');
console.log('After shell 2 adds command:');
console.log(`  Shell 1 sees history: ${shell1.session.getHistory()}`);
console.log(`  Shell 2 sees history: ${shell2.session.getHistory()}`);

// Example 6: Session Persistence Across File System Operations
console.log('\n6. Session Persistence with MemFS');
console.log('-'.repeat(60));

const fs = new MemFS();
const sessionShell = new MemShell(fs);

// Execute commands while tracking in session
sessionShell.exec('mkdir -p /workspace/src');
sessionShell.exec('write /workspace/src/app.js "console.log(\'Hello\')"');

sessionShell.session.addCommand('mkdir -p /workspace/src');
sessionShell.session.addCommand('write /workspace/src/app.js "console.log(\'Hello\')"');
sessionShell.session.setCwd('/workspace/src');

console.log(`Session CWD: ${sessionShell.session.getCwd()}`);
console.log(`File system has files: ${sessionShell.exec('ls /workspace/src').length > 0}`);
console.log(`Command history: ${sessionShell.session.getHistory().join('; ')}`);

// Example 7: Session History Management
console.log('\n7. Session History Management');
console.log('-'.repeat(60));

const historyShell = new MemShell();
const commands = [
    'mkdir /test',
    'cd /test',
    'write file.txt "content"',
    'cat file.txt',
    'rm file.txt'
];

commands.forEach(cmd => historyShell.session.addCommand(cmd));

console.log('Command History:');
historyShell.session.getHistory().forEach((cmd, i) => {
    console.log(`  ${i + 1}. ${cmd}`);
});

console.log(`\nSession info at end:`);
console.log(JSON.stringify(historyShell.session.getInfo(), null, 2));

console.log('\n' + '='.repeat(60));
console.log('Session management examples complete!');
console.log('='.repeat(60));
