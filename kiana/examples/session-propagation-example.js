/**
 * Example: Session Propagation to Node Scripts
 *
 * Demonstrates how session information (environment variables and working directory)
 * is automatically propagated to scripts executed via the 'node' command.
 */

const { MemShell, MemSession, MemFS } = require('../index.js');

console.log('\n' + '='.repeat(70));
console.log('Session Propagation to Node Scripts');
console.log('='.repeat(70));

// Create a session with specific environment and working directory
const session = new MemSession('app-session');
const fs = new MemFS();
const shell = new MemShell(fs, session);

// Example 1: Basic environment variable propagation
console.log('\n1. ENVIRONMENT VARIABLES');
console.log('-'.repeat(70));

session.setEnv('APP_NAME', 'MyApplication');
session.setEnv('APP_VERSION', '2.0.0');
session.setEnv('LOG_LEVEL', 'debug');
session.setEnv('DATABASE_URL', 'mem://localhost');

console.log('Set session environment variables:');
console.log('  APP_NAME:', session.getEnv('APP_NAME'));
console.log('  APP_VERSION:', session.getEnv('APP_VERSION'));
console.log('  LOG_LEVEL:', session.getEnv('LOG_LEVEL'));
console.log('  DATABASE_URL:', session.getEnv('DATABASE_URL'));

// Create a script that reads environment variables
shell.exec(`write /config.js "
const app = {
  name: process.env.APP_NAME,
  version: process.env.APP_VERSION,
  logLevel: process.env.LOG_LEVEL,
  dbUrl: process.env.DATABASE_URL
};
console.log('Config:', JSON.stringify(app, null, 2));
"`);

console.log('\nScript output (reads session env vars):');
const result1 = shell.exec('node /config.js');
console.log(result1);

// Example 2: Working directory propagation
console.log('\n2. WORKING DIRECTORY PROPAGATION');
console.log('-'.repeat(70));

session.setCwd('/workspace/project');
shell.exec('mkdir -p /workspace/project/src');
shell.exec('mkdir -p /workspace/project/lib');
shell.exec('write /workspace/project/README.md "# Project"');

console.log('Set session working directory:', session.getCwd());

// Create a script that uses process.cwd()
shell.exec(`write /workspace/project/src/info.js "
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
console.log('Script working directory:', cwd);
console.log('Script location:', __filename);

// List files in current directory
try {
  const files = fs.readdirSync('.');
  console.log('Files in current directory:');
  files.forEach(f => console.log('  -', f));
} catch (e) {
  console.log('Error:', e.message);
}
"`);

console.log('\nScript output (uses process.cwd()):');
const result2 = shell.exec('node /workspace/project/src/info.js');
console.log(result2);

// Example 3: Writing files relative to session working directory
console.log('\n3. FILE OPERATIONS WITH SESSION CWD');
console.log('-'.repeat(70));

shell.exec(`write /workspace/project/src/create-file.js "
const fs = require('fs');

console.log('Current working directory:', process.cwd());

// Write file relative to cwd
const filename = 'generated.txt';
const content = 'Generated at ' + new Date().toISOString();
fs.writeFileSync(filename, content);

console.log('Created file:', filename);
console.log('Full path:', require('path').resolve(filename));
"`);

console.log('\nScript creates file relative to session CWD:');
const result3 = shell.exec('node /workspace/project/src/create-file.js');
console.log(result3);

console.log('\nFile created in session working directory:');
const fileContent = shell.exec('cat /workspace/project/generated.txt');
console.log('  Content:', fileContent);

// Example 4: Environment variable override via CLI
console.log('\n4. ENVIRONMENT OVERRIDE VIA CLI');
console.log('-'.repeat(70));

console.log('Original session LOG_LEVEL:', session.getEnv('LOG_LEVEL'));

shell.exec(`write /env-test.js "
console.log('LOG_LEVEL:', process.env.LOG_LEVEL);
console.log('APP_NAME:', process.env.APP_NAME);
"`);

console.log('\nScript with CLI override (-e LOG_LEVEL=production):');
const result4 = shell.exec('node -e LOG_LEVEL=production /env-test.js');
console.log(result4);

console.log('\nNote: CLI override takes precedence over session value');
console.log('  Session LOG_LEVEL:', session.getEnv('LOG_LEVEL'));
console.log('  CLI override: -e LOG_LEVEL=production');

// Example 5: Multi-script workflow with session persistence
console.log('\n5. MULTI-SCRIPT WORKFLOW');
console.log('-'.repeat(70));

// Setup a build workspace
session.setCwd('/build');
shell.exec('mkdir -p /build/output');

session.setEnv('BUILD_ENV', 'production');
session.setEnv('OUTPUT_DIR', '/build/output');
session.setEnv('MINIFY', 'true');

// Create multiple scripts that share session state
shell.exec(`write /build/compile.js "
console.log('=== Compilation Script ===');
console.log('Build environment:', process.env.BUILD_ENV);
console.log('Output directory:', process.env.OUTPUT_DIR);
console.log('Minify enabled:', process.env.MINIFY);
console.log('Current directory:', process.cwd());
"`);

shell.exec(`write /build/test.js "
console.log('=== Test Script ===');
console.log('Build environment:', process.env.BUILD_ENV);
console.log('Current directory:', process.cwd());
"`);

console.log('Session state for build workflow:');
console.log('  BUILD_ENV:', session.getEnv('BUILD_ENV'));
console.log('  OUTPUT_DIR:', session.getEnv('OUTPUT_DIR'));
console.log('  Working directory:', session.getCwd());

console.log('\nExecuting compile script:');
const result5 = shell.exec('node /build/compile.js');
console.log(result5);

console.log('Executing test script:');
const result6 = shell.exec('node /build/test.js');
console.log(result6);

console.log('\n' + '='.repeat(70));
console.log('Session propagation examples complete!');
console.log('='.repeat(70));
console.log('\nKey Takeaways:');
console.log('  ✓ Session environment variables are automatically available in scripts');
console.log('  ✓ Session working directory is propagated to process.cwd()');
console.log('  ✓ CLI -e flags can override session environment variables');
console.log('  ✓ Scripts can access session state via process.env and process.cwd()');
console.log('  ✓ Session state persists across multiple script invocations');
console.log('');
