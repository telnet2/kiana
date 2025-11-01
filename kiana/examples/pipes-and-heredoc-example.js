#!/usr/bin/env node

/**
 * Example demonstrating pipes and HEREDOC features in MemShell
 */

const { MemShell } = require('../index');

console.log('===== Pipes and HEREDOC Examples =====\n');

const shell = new MemShell();

// Example 1: Simple pipe
console.log('Example 1: Simple Pipe');
console.log('----------------------');
shell.fs.createFile('data.txt', 'apple\nbanana\ncherry\napricot\nblueberry');
console.log('$ cat data.txt | grep a');
console.log(shell.exec('cat data.txt | grep a'));
console.log('');

// Example 2: Chained pipes
console.log('Example 2: Chained Pipes');
console.log('------------------------');
shell.fs.createFile('log.txt', 'INFO: Starting application\nERROR: Connection failed\nWARN: Retrying connection\nERROR: Authentication failed\nINFO: Shutting down');
console.log('$ cat log.txt | grep ERROR | sed s/ERROR/CRITICAL/g');
console.log(shell.exec('cat log.txt | grep ERROR | sed s/ERROR/CRITICAL/g'));
console.log('');

// Example 3: Pipe with line numbers
console.log('Example 3: Pipe with Line Numbers');
console.log('----------------------------------');
console.log('$ cat data.txt | grep -n berry');
console.log(shell.exec('cat data.txt | grep -n berry'));
console.log('');

// Example 4: HEREDOC with cat
console.log('Example 4: HEREDOC with cat');
console.log('---------------------------');
const heredocCat = `cat << EOF
This is a multi-line document
created using HEREDOC syntax.
It's very useful for creating
files with multiple lines!
EOF`;
console.log('$ cat << EOF');
console.log('> This is a multi-line document');
console.log('> created using HEREDOC syntax.');
console.log('> It\'s very useful for creating');
console.log('> files with multiple lines!');
console.log('> EOF');
console.log(shell.exec(heredocCat));
console.log('');

// Example 5: HEREDOC to create a file
console.log('Example 5: HEREDOC to Create a File');
console.log('------------------------------------');
const heredocWrite = `write config.txt << END
server:
  host: localhost
  port: 8080
database:
  connection: postgresql
  pool: 10
END`;
console.log('$ write config.txt << END');
console.log('> server:');
console.log('>   host: localhost');
console.log('>   port: 8080');
console.log('> database:');
console.log('>   connection: postgresql');
console.log('>   pool: 10');
console.log('> END');
shell.exec(heredocWrite);
console.log('File created! Contents:');
console.log(shell.exec('cat config.txt'));
console.log('');

// Example 6: HEREDOC with grep
console.log('Example 6: HEREDOC with grep');
console.log('----------------------------');
const heredocGrep = `grep -n server << EOF
client settings
server configuration
database server
client application
EOF`;
console.log('$ grep -n server << EOF');
console.log('> client settings');
console.log('> server configuration');
console.log('> database server');
console.log('> client application');
console.log('> EOF');
console.log(shell.exec(heredocGrep));
console.log('');

// Example 7: Pipe HEREDOC output
console.log('Example 7: Pipe HEREDOC Output');
console.log('-------------------------------');
const heredocPipe = `cat << DATA
error line 1
normal line
error line 2
another normal line
DATA | grep error`;
console.log('$ cat << DATA');
console.log('> error line 1');
console.log('> normal line');
console.log('> error line 2');
console.log('> another normal line');
console.log('> DATA | grep error');
console.log(shell.exec(heredocPipe));
console.log('');

// Example 8: Complex pipeline with HEREDOC
console.log('Example 8: Complex Pipeline with HEREDOC');
console.log('-----------------------------------------');
const complexPipe = `cat << CONTENT
Hello World
Test Line
Hello Universe
Another Test
CONTENT | grep Hello | sed s/Hello/Hi/g`;
console.log('$ cat << CONTENT');
console.log('> Hello World');
console.log('> Test Line');
console.log('> Hello Universe');
console.log('> Another Test');
console.log('> CONTENT | grep Hello | sed s/Hello/Hi/g');
console.log(shell.exec(complexPipe));
console.log('');

// Example 9: HEREDOC with sed
console.log('Example 9: HEREDOC with sed');
console.log('---------------------------');
const heredocSed = `sed s/old/new/g << TEXT
This is old text
More old content here
Yet another old value
TEXT`;
console.log('$ sed s/old/new/g << TEXT');
console.log('> This is old text');
console.log('> More old content here');
console.log('> Yet another old value');
console.log('> TEXT');
console.log(shell.exec(heredocSed));
console.log('');

// Example 10: Practical use case - generate and process script
console.log('Example 10: Generate and Execute Script');
console.log('----------------------------------------');
const scriptContent = `write script.js << CODE
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log('Sum:', sum);
console.log('Average:', sum / numbers.length);
CODE`;
shell.exec(scriptContent);
console.log('Created script.js with HEREDOC, now executing:');
console.log('$ node script.js');
console.log(shell.exec('node script.js'));
console.log('');

// Example 11: Output Redirection with >
console.log('Example 11: Output Redirection (Overwrite)');
console.log('------------------------------------------');
console.log('$ echo "Hello World" > greeting.txt');
shell.exec('echo "Hello World" > greeting.txt');
console.log('$ cat greeting.txt');
console.log(shell.exec('cat greeting.txt'));
console.log('');

// Example 12: Output Redirection with >> (Append)
console.log('Example 12: Output Redirection (Append)');
console.log('---------------------------------------');
console.log('$ echo "Line 1" > output.txt');
shell.exec('echo "Line 1" > output.txt');
console.log('$ echo "Line 2" >> output.txt');
shell.exec('echo "Line 2" >> output.txt');
console.log('$ echo "Line 3" >> output.txt');
shell.exec('echo "Line 3" >> output.txt');
console.log('$ cat output.txt');
console.log(shell.exec('cat output.txt'));
console.log('');

// Example 13: POSIX-Compliant HEREDOC with Output Redirection
console.log('Example 13: POSIX-Compliant HEREDOC with Output Redirection');
console.log('-----------------------------------------------------------');
const posixHeredoc = `cat > config.yaml << EOF
server:
  host: localhost
  port: 8080
database:
  connection: postgresql
  pool: 10
EOF`;
console.log('$ cat > config.yaml << EOF');
console.log('> server:');
console.log('>   host: localhost');
console.log('>   port: 8080');
console.log('> database:');
console.log('>   connection: postgresql');
console.log('>   pool: 10');
console.log('> EOF');
shell.exec(posixHeredoc);
console.log('$ cat config.yaml');
console.log(shell.exec('cat config.yaml'));
console.log('');

// Example 14: Redirect Piped Output
console.log('Example 14: Redirect Piped Output');
console.log('---------------------------------');
shell.fs.createFile('events.txt', 'INFO: Started\nERROR: Failed\nWARN: Retry\nERROR: Timeout\nINFO: Complete');
console.log('$ cat events.txt | grep ERROR > errors.txt');
shell.exec('cat events.txt | grep ERROR > errors.txt');
console.log('$ cat errors.txt');
console.log(shell.exec('cat errors.txt'));
console.log('');

// Example 15: Append with HEREDOC
console.log('Example 15: Append with HEREDOC');
console.log('--------------------------------');
console.log('$ cat >> changelog.txt << END');
console.log('> ## Version 1.0.0');
console.log('> - Initial release');
console.log('> END');
shell.exec(`cat >> changelog.txt << END
## Version 1.0.0
- Initial release
END`);
console.log('$ cat >> changelog.txt << END');
console.log('> ## Version 1.1.0');
console.log('> - Added new features');
console.log('> END');
shell.exec(`cat >> changelog.txt << END
## Version 1.1.0
- Added new features
END`);
console.log('$ cat changelog.txt');
console.log(shell.exec('cat changelog.txt'));
console.log('');

// Example 16: Complex Pipeline with Output Redirection
console.log('Example 16: Complex Pipeline with Output Redirection');
console.log('---------------------------------------------------');
const complexData = `cat << DATA | grep error | sed s/error/ERROR/g > processed-errors.txt
Line 1: normal operation
Line 2: error detected
Line 3: processing continues
Line 4: error in module
Line 5: success
DATA`;
console.log('$ cat << DATA | grep error | sed s/error/ERROR/g > processed-errors.txt');
console.log('> Line 1: normal operation');
console.log('> Line 2: error detected');
console.log('> Line 3: processing continues');
console.log('> Line 4: error in module');
console.log('> Line 5: success');
console.log('> DATA');
shell.exec(complexData);
console.log('$ cat processed-errors.txt');
console.log(shell.exec('cat processed-errors.txt'));
console.log('');

console.log('===== Examples Complete =====');
console.log('\nPipes, HEREDOC, and Output Redirection make the shell much more powerful!');
console.log('Try them out in the interactive shell: ./bin/memsh');
