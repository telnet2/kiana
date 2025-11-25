import { expect } from 'chai';
import { MemShell } from '../src/MemShell';
import { MemFS, MemFile } from '../src/MemFS';

describe('MemShell - Shell Commands', () => {
    let shell: MemShell;

    beforeEach(() => {
        shell = new MemShell();
    });

    describe('ls command', () => {
        it('should list files in current directory', () => {
            shell.fs.createFile('file1.txt', '');
            shell.fs.createFile('file2.txt', '');
            shell.fs.createDirectory('dir1');

            const output = shell.exec('ls');
            expect(output).to.include('file1.txt');
            expect(output).to.include('file2.txt');
            expect(output).to.include('dir1');
        });

        it('should list with long format (-l flag)', () => {
            shell.fs.createFile('file.txt', 'content');
            const output = shell.exec('ls -l');
            expect(output).to.match(/-rwxr-xr-x/);
            expect(output).to.include('file.txt');
        });

        it('should list specific directory', () => {
            shell.fs.createDirectory('testdir');
            shell.fs.changeDirectory('testdir');
            shell.fs.createFile('inner.txt', '');
            shell.fs.changeDirectory('/');

            const output = shell.exec('ls testdir');
            expect(output).to.include('inner.txt');
        });
    });

    describe('cat command', () => {
        it('should display file contents', () => {
            shell.fs.createFile('test.txt', 'Hello World');
            const output = shell.exec('cat test.txt');
            expect(output).to.equal('Hello World');
        });

        it('should concatenate multiple files', () => {
            shell.fs.createFile('file1.txt', 'Hello');
            shell.fs.createFile('file2.txt', 'World');
            const output = shell.exec('cat file1.txt file2.txt');
            expect(output).to.equal('HelloWorld');
        });

        it('should throw error for non-existent file', () => {
            expect(() => shell.exec('cat nonexistent.txt')).to.throw();
        });

        it('should throw error for directory', () => {
            shell.fs.createDirectory('dir');
            expect(() => shell.exec('cat dir')).to.throw(/Is a directory/);
        });
    });

    describe('pwd command', () => {
        it('should print working directory', () => {
            const output = shell.exec('pwd');
            expect(output).to.equal('/');
        });

        it('should show current directory after cd', () => {
            shell.fs.createDirectory('test');
            shell.exec('cd test');
            const output = shell.exec('pwd');
            expect(output).to.equal('/test');
        });
    });

    describe('cd command', () => {
        it('should change directory', () => {
            shell.fs.createDirectory('test');
            shell.exec('cd test');
            expect(shell.fs.getCurrentDirectory()).to.equal('/test');
        });

        it('should go to root with no arguments', () => {
            shell.fs.createDirectory('test');
            shell.exec('cd test');
            shell.exec('cd');
            expect(shell.fs.getCurrentDirectory()).to.equal('/');
        });

        it('should throw error for non-existent directory', () => {
            expect(() => shell.exec('cd nonexistent')).to.throw();
        });
    });

    describe('mkdir command', () => {
        it('should create directory', () => {
            shell.exec('mkdir testdir');
            const node = shell.fs.resolvePath('testdir');
            expect(node).to.not.be.null;
            expect(node!.isDirectory()).to.be.true;
        });

        it('should create nested directories with -p flag', () => {
            shell.exec('mkdir -p a/b/c');
            const node = shell.fs.resolvePath('a/b/c');
            expect(node).to.not.be.null;
            expect(node!.isDirectory()).to.be.true;
        });

        it('should create multiple directories', () => {
            shell.exec('mkdir dir1 dir2 dir3');
            expect(shell.fs.resolvePath('dir1')).to.not.be.null;
            expect(shell.fs.resolvePath('dir2')).to.not.be.null;
            expect(shell.fs.resolvePath('dir3')).to.not.be.null;
        });
    });

    describe('touch command', () => {
        it('should create empty file', () => {
            shell.exec('touch newfile.txt');
            const node = shell.fs.resolvePath('newfile.txt');
            expect(node).to.not.be.null;
            expect(node!.isFile()).to.be.true;
            expect((node as MemFile).read()).to.equal('');
        });

        it('should update timestamp of existing file', (done: Mocha.Done) => {
            shell.fs.createFile('existing.txt', 'content');
            const node = shell.fs.resolvePath('existing.txt')!;
            const oldTime = node.modifiedAt;

            setTimeout(() => {
                shell.exec('touch existing.txt');
                expect(node.modifiedAt.getTime()).to.be.greaterThan(oldTime.getTime());
                done();
            }, 10);
        });
    });

    describe('rm command', () => {
        it('should remove file', () => {
            shell.fs.createFile('test.txt', '');
            shell.exec('rm test.txt');
            expect(shell.fs.resolvePath('test.txt')).to.be.null;
        });

        it('should remove directory with -r flag', () => {
            shell.fs.createDirectory('dir');
            shell.fs.createFile('dir/file.txt', '');
            shell.exec('rm -r dir');
            expect(shell.fs.resolvePath('dir')).to.be.null;
        });

        it('should throw error removing non-empty directory without -r', () => {
            shell.fs.createDirectory('dir');
            shell.fs.createFile('dir/file.txt', '');
            expect(() => shell.exec('rm dir')).to.throw();
        });
    });

    describe('echo command', () => {
        it('should display text', () => {
            const output = shell.exec('echo Hello World');
            expect(output).to.equal('Hello World');
        });
    });

    describe('grep command', () => {
        beforeEach(() => {
            shell.fs.createFile('test.txt', 'Hello World\nFoo Bar\nHello Again');
        });

        it('should find matching lines', () => {
            const output = shell.exec('grep Hello test.txt');
            expect(output).to.include('Hello World');
            expect(output).to.include('Hello Again');
            expect(output).to.not.include('Foo Bar');
        });

        it('should search case-insensitive with -i flag', () => {
            const output = shell.exec('grep -i hello test.txt');
            expect(output).to.include('Hello World');
        });

        it('should show line numbers with -n flag', () => {
            const output = shell.exec('grep -n Hello test.txt');
            expect(output).to.match(/1:Hello World/);
            expect(output).to.match(/3:Hello Again/);
        });
    });

    describe('find command', () => {
        beforeEach(() => {
            shell.fs.createDirectories('a/b');
            shell.fs.createFile('a/file1.txt', '');
            shell.fs.createFile('a/b/file2.js', '');
            shell.fs.createFile('a/b/test.txt', '');
        });

        it('should find all files and directories', () => {
            const output = shell.exec('find a');
            expect(output).to.include('/a');
            expect(output).to.include('/a/file1.txt');
            expect(output).to.include('/a/b');
            expect(output).to.include('/a/b/file2.js');
        });

        it('should filter by name pattern', () => {
            const output = shell.exec('find a -name *.txt');
            expect(output).to.include('file1.txt');
            expect(output).to.include('test.txt');
            expect(output).to.not.include('file2.js');
        });

        it('should filter by type (files only)', () => {
            const output = shell.exec('find a -type f');
            expect(output).to.include('file1.txt');
            expect(output).to.include('file2.js');
            expect(output).to.not.include('/a/b\n'); // directory
        });

        it('should filter by type (directories only)', () => {
            const output = shell.exec('find a -type d');
            expect(output).to.include('/a');
            expect(output).to.include('/a/b');
            expect(output).to.not.include('file1.txt');
        });
    });

    describe('sed command', () => {
        it('should substitute text in file', () => {
            shell.fs.createFile('test.txt', 'Hello World');
            const output = shell.exec('sed s/World/Universe/g test.txt');
            expect(output).to.equal('Hello Universe');
        });

        it('should modify file in-place with -i flag', () => {
            shell.fs.createFile('test.txt', 'foo bar foo');
            shell.exec('sed -i s/foo/baz/g test.txt');
            const content = (shell.fs.resolvePath('test.txt') as MemFile).read();
            expect(content).to.equal('baz bar baz');
        });

        it('should handle regex patterns', () => {
            shell.fs.createFile('test.txt', 'test123 test456');
            const output = shell.exec('sed s/test[0-9]+/NUM/g test.txt');
            expect(output).to.include('NUM');
        });
    });

    describe('write command', () => {
        it('should write content to new file', () => {
            shell.exec('write test.txt Hello World');
            const node = shell.fs.resolvePath('test.txt')!;
            expect((node as MemFile).read()).to.equal('Hello World');
        });

        it('should overwrite existing file', () => {
            shell.fs.createFile('test.txt', 'old content');
            shell.exec('write test.txt new content');
            const node = shell.fs.resolvePath('test.txt')!;
            expect((node as MemFile).read()).to.equal('new content');
        });
    });

    describe('node command', () => {
        it('should execute JavaScript file', () => {
            shell.fs.createFile('script.js', "console.log('Hello from script');");
            const output = shell.exec('node script.js');
            expect(output).to.equal('Hello from script');
        });

        it('should handle console methods', () => {
            shell.fs.createFile('script.js', `
                console.log('log message');
                console.error('error message');
                console.warn('warn message');
            `);
            const output = shell.exec('node script.js');
            expect(output).to.include('log message');
            expect(output).to.include('ERROR: error message');
            expect(output).to.include('WARN: warn message');
        });

        it('should provide process.argv', () => {
            shell.fs.createFile('args.js', `
                console.log(process.argv.join(' '));
            `);
            const output = shell.exec('node args.js arg1 arg2');
            expect(output).to.include('arg1 arg2');
        });

        it('should support require for memory filesystem modules', () => {
            shell.fs.createFile('module.js', 'module.exports = { value: 42 };');
            shell.fs.createFile('main.js', `
                const mod = require('./module.js');
                console.log(mod.value);
            `);
            const output = shell.exec('node main.js');
            expect(output).to.equal('42');
        });
    });

    describe('Command parsing', () => {
        it('should parse flags correctly', () => {
            const { flags, positional } = shell.parseArgs(['-l', '-a', 'test']);
            expect(flags.l).to.be.true;
            expect(flags.a).to.be.true;
            expect(positional[0]).to.equal('test');
        });

        it('should parse long flags', () => {
            const { flags } = shell.parseArgs(['--name', 'test.txt']);
            expect(flags.name).to.equal('test.txt');
        });

        it('should parse combined short flags', () => {
            const { flags } = shell.parseArgs(['-la']);
            expect(flags.l).to.be.true;
            expect(flags.a).to.be.true;
        });
    });

    describe('Pipes', () => {
        it('should pipe cat to grep', () => {
            shell.fs.createFile('test.txt', 'line1\nline2 error\nline3\nline4 error');
            const output = shell.exec('cat test.txt | grep error');
            expect(output).to.include('line2 error');
            expect(output).to.include('line4 error');
            expect(output).to.not.include('line1');
            expect(output).to.not.include('line3');
        });

        it('should chain multiple pipes', () => {
            shell.fs.createFile('data.txt', 'Hello World\nHello Universe\nGoodbye World');
            const output = shell.exec('cat data.txt | grep Hello | sed s/Hello/Hi/g');
            expect(output).to.include('Hi World');
            expect(output).to.include('Hi Universe');
            expect(output).to.not.include('Goodbye');
        });

        it('should pipe echo to grep', () => {
            const output = shell.exec('echo "test line error" | grep error');
            expect(output).to.equal('test line error');
        });

        it('should pipe cat to sed', () => {
            shell.fs.createFile('test.txt', 'foo bar foo');
            const output = shell.exec('cat test.txt | sed s/foo/baz/g');
            expect(output).to.equal('baz bar baz');
        });

        it('should handle pipe with line numbers', () => {
            shell.fs.createFile('test.txt', 'line1\ntest\nline3\ntest');
            const output = shell.exec('cat test.txt | grep -n test');
            expect(output).to.include('2:test');
            expect(output).to.include('4:test');
        });
    });

    describe('HEREDOC', () => {
        it('should handle inline HEREDOC with cat', () => {
            const output = shell.exec('cat << EOF\nline 1\nline 2\nline 3\nEOF');
            expect(output).to.equal('line 1\nline 2\nline 3');
        });

        it('should handle HEREDOC with grep', () => {
            const output = shell.exec('grep error << EOF\nno match\nerror line\nanother error\nEOF');
            expect(output).to.include('error line');
            expect(output).to.include('another error');
            expect(output).to.not.include('no match');
        });

        it('should handle HEREDOC with sed', () => {
            const output = shell.exec('sed s/old/new/g << EOF\nold text\nold again\nEOF');
            expect(output).to.equal('new text\nnew again');
        });

        it('should create file with HEREDOC using write', () => {
            shell.exec('write test.txt << EOF\nmultiline\ncontent\nhere\nEOF');
            const node = shell.fs.resolvePath('test.txt')!;
            expect((node as MemFile).read()).to.equal('multiline\ncontent\nhere');
        });

        it('should handle HEREDOC with different delimiter', () => {
            const output = shell.exec('cat << END\nsome content\nmore content\nEND');
            expect(output).to.equal('some content\nmore content');
        });
    });

    describe('Pipes and HEREDOC combined', () => {
        it('should pipe HEREDOC output to grep', () => {
            const output = shell.exec('cat << EOF\nline one\nerror here\nline three\nEOF | grep error');
            expect(output).to.equal('error here');
        });

        it('should chain HEREDOC through multiple pipes', () => {
            const output = shell.exec('cat << EOF\nHello World\nTest Line\nHello Again\nEOF | grep Hello | sed s/Hello/Hi/g');
            expect(output).to.include('Hi World');
            expect(output).to.include('Hi Again');
            expect(output).to.not.include('Test Line');
        });
    });

    describe('Output Redirection', () => {
        it('should redirect output to file with >', () => {
            shell.exec('echo Hello World > test.txt');
            const node = shell.fs.resolvePath('test.txt')!;
            expect((node as MemFile).read()).to.equal('Hello World');
        });

        it('should overwrite existing file with >', () => {
            shell.fs.createFile('test.txt', 'old content');
            shell.exec('echo new content > test.txt');
            const node = shell.fs.resolvePath('test.txt')!;
            expect((node as MemFile).read()).to.equal('new content');
        });

        it('should append to file with >>', () => {
            shell.fs.createFile('test.txt', 'line 1');
            shell.exec('echo line 2 >> test.txt');
            const node = shell.fs.resolvePath('test.txt')!;
            expect((node as MemFile).read()).to.equal('line 1\nline 2');
        });

        it('should create file if it does not exist with >>', () => {
            shell.exec('echo first line >> newfile.txt');
            const node = shell.fs.resolvePath('newfile.txt')!;
            expect((node as MemFile).read()).to.equal('first line');
        });

        it('should redirect cat output to file', () => {
            shell.fs.createFile('source.txt', 'file contents');
            shell.exec('cat source.txt > dest.txt');
            const node = shell.fs.resolvePath('dest.txt')!;
            expect((node as MemFile).read()).to.equal('file contents');
        });

        it('should redirect grep output to file', () => {
            shell.fs.createFile('data.txt', 'line1\nerror here\nline3');
            shell.exec('grep error data.txt > results.txt');
            const node = shell.fs.resolvePath('results.txt')!;
            expect((node as MemFile).read()).to.equal('error here');
        });

        it('should redirect piped output to file', () => {
            shell.fs.createFile('data.txt', 'foo bar foo');
            shell.exec('cat data.txt | sed s/foo/baz/g > output.txt');
            const node = shell.fs.resolvePath('output.txt')!;
            expect((node as MemFile).read()).to.equal('baz bar baz');
        });

        it('should handle HEREDOC with output redirection (POSIX)', () => {
            shell.exec('cat > config.txt << EOF\nserver: localhost\nport: 8080\nEOF');
            const node = shell.fs.resolvePath('config.txt')!;
            expect((node as MemFile).read()).to.equal('server: localhost\nport: 8080');
        });

        it('should handle HEREDOC with append redirection', () => {
            shell.fs.createFile('log.txt', 'existing line');
            shell.exec('cat >> log.txt << EOF\nnew line 1\nnew line 2\nEOF');
            const node = shell.fs.resolvePath('log.txt')!;
            expect((node as MemFile).read()).to.equal('existing line\nnew line 1\nnew line 2');
        });

        it('should handle multiple files in HEREDOC output redirection', () => {
            shell.exec('cat > script.js << CODE\nconsole.log("Hello");\nconsole.log("World");\nCODE');
            const node = shell.fs.resolvePath('script.js')!;
            expect((node as MemFile).read()).to.include('console.log("Hello")');
            expect((node as MemFile).read()).to.include('console.log("World")');
        });
    });

    describe('Error handling', () => {
        it('should throw error for unknown command', () => {
            expect(() => shell.exec('unknowncommand')).to.throw(/command not found/);
        });

        it('should handle empty command gracefully', () => {
            const output = shell.exec('');
            expect(output).to.equal('');
        });

        it('should handle whitespace-only command', () => {
            const output = shell.exec('   ');
            expect(output).to.equal('');
        });
    });
});