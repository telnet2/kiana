# MemShell Sessions

Sessions allow Kiana to maintain persistent state across commands within a shell lifetime. Each session manages:

- **Command History**: Track all executed commands
- **Environment Variables**: Store session-specific configuration
- **Working Directory**: Persist the current directory

## Quick Start

### Using Default Session

Every `MemShell` automatically creates a default session:

```javascript
const { MemShell } = require('kiana');

const shell = new MemShell();

// Commands are automatically tracked
shell.session.addCommand('mkdir /test');
shell.session.addCommand('cd /test');

// Access session info
console.log(shell.session.getHistory());
// ['mkdir /test', 'cd /test']

console.log(shell.session.getId());
// 'session-1234567890-abcd1234'
```

### Named Sessions

Create named sessions for different environments:

```javascript
const { MemShell, MemSession } = require('kiana');

// Create development session
const devSession = new MemSession('dev');
const devShell = new MemShell(null, devSession);

devShell.session.setEnv('DEBUG', 'true');
devShell.session.setEnv('LOG_LEVEL', 'debug');

// Create production session
const prodSession = new MemSession('prod');
const prodShell = new MemShell(null, prodSession);

prodShell.session.setEnv('DEBUG', 'false');
prodShell.session.setEnv('LOG_LEVEL', 'error');
```

## Session API

### Command History

```javascript
const shell = new MemShell();

// Add command
shell.session.addCommand('echo "Hello"');

// Get all history
const history = shell.session.getHistory();
// ['echo "Hello"']

// Get specific entry (negative index from end)
shell.session.getHistoryEntry(-1);  // Last command
shell.session.getHistoryEntry(-2);  // Second to last

// Clear history
shell.session.clearHistory();
```

### Environment Variables

```javascript
const shell = new MemShell();

// Set single variable
shell.session.setEnv('APP_NAME', 'MyApp');
shell.session.setEnv('VERSION', '1.0.0');

// Get variable
console.log(shell.session.getEnv('APP_NAME'));
// 'MyApp'

// Set multiple variables
shell.session.setEnvVars({
    'NODE_ENV': 'production',
    'PORT': '3000'
});

// Get all variables
const allEnv = shell.session.getAllEnv();

// Unset variable
shell.session.unsetEnv('DEBUG');
```

### Working Directory

```javascript
const shell = new MemShell();

// Set working directory
shell.session.setCwd('/home/user');

// Get current working directory
console.log(shell.session.getCwd());
// '/home/user'
```

### Session Information

```javascript
const shell = new MemShell();

// Get complete session info
const info = shell.session.getInfo();
// {
//   id: 'session-1234567890-abcd1234',
//   createdAt: 2025-11-01T12:00:00.000Z,
//   historySize: 0,
//   envVarCount: 52,
//   cwd: '/'
// }

// Get individual properties
console.log(shell.session.getId());
console.log(shell.session.getCreatedAt());
```

## Shared Sessions

Multiple shells can share the same session:

```javascript
const { MemShell, MemSession } = require('kiana');

// Create shared session
const sharedSession = new MemSession('workspace');

// Create multiple shells with same session
const shell1 = new MemShell(null, sharedSession);
const shell2 = new MemShell(null, sharedSession);

// Both shells see the same state
shell1.session.addCommand('cmd1');
shell2.session.addCommand('cmd2');

console.log(shell1.session.getHistory());
// ['cmd1', 'cmd2']

console.log(shell2.session.getHistory());
// ['cmd1', 'cmd2']
```

## Session with MemREPL

The REPL automatically integrates with sessions:

```javascript
const { MemREPL, MemSession } = require('kiana');

// Create REPL with default session
const repl = new MemREPL();

// Or use specific session
const session = new MemSession('interactive');
const repl = new MemREPL(null, session);

// Commands entered in REPL are tracked automatically
// Type 'history' to see command history
```

## Session with KianaAgent

Kiana maintains its own session automatically:

```javascript
const { runKiana } = require('kiana');

// Kiana creates its own session internally
const result = await runKiana(
    'Create a test directory and list files',
    {}
);

// The session persists across multiple Kiana invocations
```

## Configuration

### History Size

Control maximum history entries (default: 1000):

```javascript
const session = new MemSession('my-session', 500);  // Max 500 entries
const shell = new MemShell(null, session);
```

When history exceeds max size, oldest entries are removed.

## Use Cases

### Development Workflow
Track commands for reproducibility:
```javascript
const devSession = new MemSession('dev-session');
const shell = new MemShell(null, devSession);

// Execute build commands
shell.exec('npm install');
shell.exec('npm run build');
shell.exec('npm test');

// Later, review what was done
shell.session.getHistory();
```

### Multi-Environment Testing
Separate sessions for different configurations:
```javascript
const sessions = {
    dev: new MemSession('dev'),
    staging: new MemSession('staging'),
    prod: new MemSession('prod')
};

// Each has independent state
```

### Interactive Shell
Track user commands in REPL:
```javascript
const repl = new MemREPL();
repl.start();

// User types commands interactively
// Type 'history' to see all commands
```

## See Also

- `examples/session-example.js` - Comprehensive examples
- `src/MemSession.ts` - Source code
- `src/MemShell.ts` - Shell integration
- `src/MemREPL.ts` - REPL integration
