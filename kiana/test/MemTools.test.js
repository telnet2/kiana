const { expect } = require('chai');
const { MemTools } = require('../lib/MemTools');
const { MemFS } = require('../lib/MemFS');

describe('MemTools - LLM Tool Interface', () => {
    let memtools;

    beforeEach(() => {
        memtools = new MemTools();
    });

    describe('Initialization', () => {
        it('should create new instance with default MemFS', () => {
            expect(memtools).to.be.instanceOf(MemTools);
            expect(memtools.fs).to.exist;
            expect(memtools.shell).to.exist;
        });

        it('should accept existing MemFS instance', () => {
            const fs = new MemFS();
            fs.createFile('test.txt', 'content');

            const tools = new MemTools(fs);
            expect(tools.fs).to.equal(fs);
            expect(tools.exec('cat test.txt')).to.equal('content');
        });
    });

    describe('exec() method', () => {
        it('should execute simple commands', () => {
            memtools.exec('mkdir test');
            const output = memtools.exec('ls');
            expect(output).to.include('test');
        });

        it('should execute multiline commands (HEREDOC)', () => {
            const command = `cat > hello.txt << EOF
line 1
line 2
line 3
EOF`;
            memtools.exec(command);
            const content = memtools.exec('cat hello.txt');
            expect(content).to.equal('line 1\nline 2\nline 3');
        });

        it('should support pipes', () => {
            memtools.exec('echo "error line\ninfo line\nerror again" > log.txt');
            const output = memtools.exec('cat log.txt | grep error');
            expect(output).to.include('error line');
            expect(output).to.include('error again');
            expect(output).to.not.include('info line');
        });

        it('should support output redirection', () => {
            memtools.exec('echo Hello World > greeting.txt');
            const content = memtools.exec('cat greeting.txt');
            expect(content).to.equal('Hello World');
        });

        it('should maintain state across multiple calls', () => {
            memtools.exec('mkdir project');
            memtools.exec('cd project');
            memtools.exec('touch file.txt');

            const files = memtools.exec('ls');
            expect(files).to.include('file.txt');
        });

        it('should throw error on invalid command', () => {
            expect(() => memtools.exec('invalidcommand')).to.throw(/Command failed/);
        });

        it('should handle empty commands', () => {
            const output = memtools.exec('');
            expect(output).to.equal('');
        });
    });

    describe('Tool Definitions', () => {
        it('should provide OpenAI tool definition', () => {
            const def = memtools.getOpenAIToolDefinition();

            expect(def).to.have.property('type', 'function');
            expect(def.function).to.have.property('name', 'memfs_exec');
            expect(def.function).to.have.property('description');
            expect(def.function.parameters).to.have.property('type', 'object');
            expect(def.function.parameters.properties).to.have.property('command');
            expect(def.function.parameters.required).to.include('command');
        });

        it('should provide Anthropic tool definition', () => {
            const def = memtools.getAnthropicToolDefinition();

            expect(def).to.have.property('name', 'memfs_exec');
            expect(def).to.have.property('description');
            expect(def.input_schema).to.have.property('type', 'object');
            expect(def.input_schema.properties).to.have.property('command');
            expect(def.input_schema.required).to.include('command');
        });

        it('should provide MCP tool definition', () => {
            const def = memtools.getMCPToolDefinition();

            expect(def).to.have.property('name', 'memfs_exec');
            expect(def).to.have.property('description');
            expect(def.inputSchema).to.have.property('type', 'object');
            expect(def.inputSchema.properties).to.have.property('command');
            expect(def.inputSchema.required).to.include('command');
        });

        it('should provide generic tool definition', () => {
            const def = memtools.getToolDefinition();

            expect(def).to.have.property('name', 'memfs_exec');
            expect(def).to.have.property('description');
            expect(def.parameters).to.have.property('type', 'object');
            expect(def.parameters.properties).to.have.property('command');
        });
    });

    describe('handleToolCall()', () => {
        it('should handle OpenAI-style tool call', () => {
            const toolCall = {
                arguments: { command: 'echo test' }
            };
            const result = memtools.handleToolCall(toolCall);
            expect(result).to.equal('test');
        });

        it('should handle Anthropic-style tool call', () => {
            const toolCall = {
                input: { command: 'echo test' }
            };
            const result = memtools.handleToolCall(toolCall);
            expect(result).to.equal('test');
        });

        it('should handle direct command property', () => {
            const toolCall = {
                command: 'echo test'
            };
            const result = memtools.handleToolCall(toolCall);
            expect(result).to.equal('test');
        });

        it('should throw error if command missing', () => {
            expect(() => memtools.handleToolCall({})).to.throw(/Missing command/);
        });
    });

    describe('State Management', () => {
        it('should get current working directory', () => {
            const cwd = memtools.getCwd();
            expect(cwd).to.equal('/');

            memtools.exec('mkdir test');
            memtools.exec('cd test');
            expect(memtools.getCwd()).to.equal('/test');
        });

        it('should reset file system', () => {
            memtools.exec('mkdir test');
            memtools.exec('touch file.txt');

            memtools.reset();

            const files = memtools.exec('ls');
            expect(files).to.equal('');
        });

        it('should export state', () => {
            memtools.exec('mkdir dir1');
            memtools.exec('echo content > file1.txt');

            const state = memtools.exportState();

            expect(state).to.have.property('cwd', '/');
            expect(state).to.have.property('root');
            expect(state.root.type).to.equal('directory');
            expect(state.root.children).to.have.lengthOf(2);
        });

        it('should import state', () => {
            // Create initial state
            memtools.exec('mkdir project');
            memtools.exec('cd project');
            memtools.exec('echo "Hello" > readme.txt');

            const state = memtools.exportState();

            // Reset and import
            memtools.reset();
            memtools.importState(state);

            // Verify state restored
            expect(memtools.getCwd()).to.equal('/project');
            const content = memtools.exec('cat readme.txt');
            expect(content).to.equal('Hello');
        });

        it('should export and import complex state', () => {
            // Create complex structure
            memtools.exec('mkdir -p src/components tests/unit');
            memtools.exec('echo "code" > src/index.js');
            memtools.exec('echo "component" > src/components/Button.js');
            memtools.exec('echo "test" > tests/unit/test.js');

            const state = memtools.exportState();
            memtools.reset();
            memtools.importState(state);

            // Verify structure
            const files = memtools.exec('find . -type f');
            expect(files).to.include('src/index.js');
            expect(files).to.include('src/components/Button.js');
            expect(files).to.include('tests/unit/test.js');
        });
    });

    describe('Advanced Features', () => {
        it('should execute JavaScript code', () => {
            memtools.exec(`cat > script.js << EOF
console.log('Hello from JS');
console.log(2 + 2);
EOF`);

            const output = memtools.exec('node script.js');
            expect(output).to.include('Hello from JS');
            expect(output).to.include('4');
        });

        it('should support module system', () => {
            memtools.exec(`cat > math.js << EOF
module.exports = { add: (a, b) => a + b };
EOF`);

            memtools.exec(`cat > main.js << EOF
const math = require('./math.js');
console.log(math.add(5, 3));
EOF`);

            const output = memtools.exec('node main.js');
            expect(output).to.equal('8');
        });

        it('should support complex pipelines', () => {
            memtools.exec(`cat > data.txt << EOF
INFO: Started
ERROR: Failed
WARN: Retry
ERROR: Timeout
INFO: Complete
EOF`);

            const output = memtools.exec('cat data.txt | grep ERROR | sed s/ERROR/CRITICAL/g');
            expect(output).to.include('CRITICAL: Failed');
            expect(output).to.include('CRITICAL: Timeout');
            expect(output).to.not.include('INFO');
        });

        it('should support POSIX-compliant HEREDOC with redirection', () => {
            memtools.exec(`cat > config.yml << EOF
server:
  port: 8080
database:
  host: localhost
EOF`);

            const content = memtools.exec('cat config.yml');
            expect(content).to.include('server:');
            expect(content).to.include('port: 8080');
            expect(content).to.include('database:');
        });

        it('should handle append operations', () => {
            memtools.exec('echo "Line 1" > log.txt');
            memtools.exec('echo "Line 2" >> log.txt');
            memtools.exec('echo "Line 3" >> log.txt');

            const content = memtools.exec('cat log.txt');
            expect(content).to.equal('Line 1\nLine 2\nLine 3');
        });
    });

    describe('Real-world LLM Use Cases', () => {
        it('should create project structure', () => {
            // Simulate LLM creating a project
            memtools.exec('mkdir -p src tests docs');
            memtools.exec(`cat > package.json << EOF
{
  "name": "my-app",
  "version": "1.0.0"
}
EOF`);
            memtools.exec('cat > src/index.js << EOF\nconsole.log("App");\nEOF');
            memtools.exec('cat > README.md << EOF\n# My App\nEOF');

            const files = memtools.exec('find . -type f');
            expect(files).to.include('package.json');
            expect(files).to.include('src/index.js');
            expect(files).to.include('README.md');
        });

        it('should process and analyze logs', () => {
            // Simulate LLM analyzing server logs
            memtools.exec(`cat > server.log << EOF
2024-01-01 10:00:00 INFO Server started
2024-01-01 10:05:00 ERROR Connection failed
2024-01-01 10:10:00 ERROR Timeout
2024-01-01 10:15:00 INFO Request completed
EOF`);

            memtools.exec('cat server.log | grep ERROR > errors.txt');
            const errors = memtools.exec('cat errors.txt');

            expect(errors).to.include('Connection failed');
            expect(errors).to.include('Timeout');
            expect(errors).to.not.include('INFO');
        });

        it('should generate and execute code', () => {
            // Simulate LLM writing and testing code
            memtools.exec(`cat > calculator.js << EOF
function add(a, b) { return a + b; }
function multiply(a, b) { return a * b; }
console.log('5 + 3 =', add(5, 3));
console.log('4 * 7 =', multiply(4, 7));
EOF`);

            const output = memtools.exec('node calculator.js');
            expect(output).to.include('5 + 3 = 8');
            expect(output).to.include('4 * 7 = 28');
        });

        it('should maintain conversation context', () => {
            // Simulate multi-turn conversation with LLM

            // Turn 1: Create file
            memtools.exec('echo "Initial content" > doc.txt');

            // Turn 2: Append to file
            memtools.exec('echo "Additional content" >> doc.txt');

            // Turn 3: Process file
            const output = memtools.exec('cat doc.txt | sed s/content/data/g');

            expect(output).to.equal('Initial data\nAdditional data');
        });
    });

    describe('Error Handling', () => {
        it('should provide meaningful error messages', () => {
            expect(() => memtools.exec('cat nonexistent.txt'))
                .to.throw(/Command failed.*No such file/);
        });

        it('should handle syntax errors gracefully', () => {
            expect(() => memtools.exec('cat > file << EOF'))
                .to.throw(/Command failed/);
        });

        it('should handle invalid JavaScript', () => {
            memtools.exec('cat > bad.js << EOF\nthis is not valid js\nEOF');
            expect(() => memtools.exec('node bad.js'))
                .to.throw(/Command failed/);
        });
    });

    describe('getFileSystem()', () => {
        it('should return underlying MemFS instance', () => {
            const fs = memtools.getFileSystem();
            expect(fs).to.equal(memtools.fs);

            // Can use FS directly
            fs.createFile('direct.txt', 'content');
            const content = memtools.exec('cat direct.txt');
            expect(content).to.equal('content');
        });
    });
});
