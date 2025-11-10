#!/usr/bin/env node

import { MemREPL } from '../lib/MemREPL';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI Options Interface
 */
interface CLIOptions {
  command: string | null;
  script: string | null;
  interactive: boolean;
}

/**
 * Parse command line arguments
 */
function parseCliArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    command: null,
    script: null,
    interactive: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-c') {
      options.command = args[++i];
      options.interactive = false;
    } else if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    } else if (arg === '--version') {
      showVersion();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      options.script = arg;
      options.interactive = false;
    }
  }

  return options;
}

/**
 * Show version information
 */
function showVersion(): void {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log(`memsh version ${pkg.version}`);
  } catch (err) {
    console.log('memsh version unknown');
  }
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
memsh - In-Memory File System Shell

Usage:
  memsh                    Start interactive shell
  memsh -c <command>       Execute a single command
  memsh <script.sh>        Execute commands from a script file

Options:
  -h, --help               Show this help message
  --version                Show version information

Interactive Mode:
  Once in the shell, type "help" to see available commands.

Examples:
  # Start interactive shell
  $ memsh

  # Execute a single command
  $ memsh -c "mkdir test && cd test && touch file.txt"

  # Run a script
  $ memsh script.sh

For more information, visit: https://github.com/telnet2/utileejs
`);
}

/**
 * Main entry point
 */
function main(): void {
  const options = parseCliArgs();
  const repl = new MemREPL();

  if (options.command) {
    // Execute single command
    const exitCode = repl.execCommand(options.command);
    process.exit(exitCode);
  } else if (options.script) {
    // Execute script file
    try {
      const scriptPath = path.resolve(options.script);
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      const commands = scriptContent.split('\n');
      const exitCode = repl.execScript(commands);
      process.exit(exitCode);
    } catch (err: any) {
      console.error(`Error reading script: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Interactive mode
    repl.start();
  }
}

// Run the CLI
if (require.main === module) {
  main();
}