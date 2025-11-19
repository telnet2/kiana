import { expect } from 'chai';
import { MemShell } from '../src/MemShell';
import { MemFS } from '../src/MemFS';

describe('Shell Commands', () => {
    let shell: MemShell;
    let fs: MemFS;

    beforeEach(() => {
        fs = new MemFS();
        shell = new MemShell(fs);
    });

    describe('head command', () => {
        beforeEach(() => {
            fs.createFile('test.txt', 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11\nline12');
        });

        it('should output first 10 lines by default', () => {
            const result = shell.exec('head test.txt');
            const lines = result.split('\n');
            expect(lines.length).to.equal(10);
            expect(lines[0]).to.equal('line1');
            expect(lines[9]).to.equal('line10');
        });

        it('should output first N lines with -n flag', () => {
            const result = shell.exec('head -n 3 test.txt');
            const lines = result.split('\n');
            expect(lines.length).to.equal(3);
            expect(lines[0]).to.equal('line1');
            expect(lines[2]).to.equal('line3');
        });

        it('should work with stdin', () => {
            const result = shell.exec('cat test.txt | head -n 5');
            const lines = result.split('\n');
            expect(lines.length).to.equal(5);
        });
    });

    describe('tail command', () => {
        beforeEach(() => {
            fs.createFile('test.txt', 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11\nline12');
        });

        it('should output last 10 lines by default', () => {
            const result = shell.exec('tail test.txt');
            const lines = result.split('\n');
            expect(lines.length).to.equal(10);
            expect(lines[0]).to.equal('line3');
            expect(lines[9]).to.equal('line12');
        });

        it('should output last N lines with -n flag', () => {
            const result = shell.exec('tail -n 3 test.txt');
            const lines = result.split('\n');
            expect(lines.length).to.equal(3);
            expect(lines[0]).to.equal('line10');
            expect(lines[2]).to.equal('line12');
        });

        it('should work with stdin', () => {
            const result = shell.exec('cat test.txt | tail -n 5');
            const lines = result.split('\n');
            expect(lines.length).to.equal(5);
        });
    });

    describe('cut command', () => {
        beforeEach(() => {
            fs.createFile('data.txt', 'a:b:c\n1:2:3\nx:y:z');
        });

        it('should extract fields with -f flag', () => {
            const result = shell.exec("cut -d: -f1 data.txt");
            const lines = result.split('\n');
            expect(lines[0]).to.equal('a');
            expect(lines[1]).to.equal('1');
            expect(lines[2]).to.equal('x');
        });

        it('should extract multiple fields', () => {
            const result = shell.exec("cut -d: -f1,3 data.txt");
            const lines = result.split('\n');
            expect(lines[0]).to.equal('a:c');
            expect(lines[1]).to.equal('1:3');
        });

        it('should work with stdin', () => {
            const result = shell.exec("echo 'a:b:c' | cut -d: -f2");
            expect(result).to.equal('b');
        });
    });

    describe('sort command', () => {
        beforeEach(() => {
            fs.createFile('numbers.txt', '3\n1\n4\n1\n5\n9\n2\n6');
        });

        it('should sort lines alphabetically', () => {
            fs.createFile('words.txt', 'zebra\napple\nbanana');
            const result = shell.exec('sort words.txt');
            const lines = result.split('\n');
            expect(lines[0]).to.equal('apple');
            expect(lines[1]).to.equal('banana');
            expect(lines[2]).to.equal('zebra');
        });

        it('should sort numerically with -n flag', () => {
            const result = shell.exec('sort -n numbers.txt');
            const lines = result.split('\n');
            expect(lines[0]).to.equal('1');
            expect(lines[1]).to.equal('1');
            expect(lines[2]).to.equal('2');
        });

        it('should reverse sort with -r flag', () => {
            const result = shell.exec('sort -r -n numbers.txt');
            const lines = result.split('\n');
            expect(lines[0]).to.equal('9');
            expect(lines[lines.length - 1]).to.equal('1');
        });

        it('should remove duplicates with -u flag', () => {
            const result = shell.exec('sort -u -n numbers.txt');
            const lines = result.split('\n');
            expect(lines.length).to.equal(7); // 1,2,3,4,5,6,9
        });
    });

    describe('uniq command', () => {
        beforeEach(() => {
            fs.createFile('duplicates.txt', 'apple\napple\nbanana\nbanana\nbanana\ncherry');
        });

        it('should filter adjacent duplicates', () => {
            const result = shell.exec('uniq duplicates.txt');
            const lines = result.split('\n');
            expect(lines[0]).to.equal('apple');
            expect(lines[1]).to.equal('banana');
            expect(lines[2]).to.equal('cherry');
        });

        it('should count occurrences with -c flag', () => {
            const result = shell.exec('uniq -c duplicates.txt');
            const lines = result.split('\n');
            expect(lines[0]).to.include('apple');
            expect(lines[0]).to.include('2');
        });

        it('should show only duplicates with -d flag', () => {
            const result = shell.exec('uniq -d duplicates.txt');
            const lines = result.split('\n').filter(l => l);
            expect(lines[0]).to.equal('apple');
            expect(lines[1]).to.equal('banana');
        });
    });

    describe('file command', () => {
        it('should identify text files', () => {
            fs.createFile('test.txt', 'hello world');
            const result = shell.exec('file test.txt');
            expect(result).to.include('ASCII text');
        });

        it('should identify JSON files', () => {
            fs.createFile('data.json', '{"name":"test"}');
            const result = shell.exec('file data.json');
            expect(result).to.include('JSON');
        });

        it('should identify directories', () => {
            fs.createDirectory('testdir');
            const result = shell.exec('file testdir');
            expect(result).to.include('directory');
        });

        it('should identify empty files', () => {
            fs.createFile('empty.txt', '');
            const result = shell.exec('file empty.txt');
            expect(result).to.include('empty');
        });
    });

    describe('basename command', () => {
        it('should extract filename from path', () => {
            const result = shell.exec('basename /tmp/test.txt');
            expect(result).to.equal('test.txt');
        });

        it('should remove suffix if provided', () => {
            const result = shell.exec('basename /tmp/test.txt .txt');
            expect(result).to.equal('test');
        });

        it('should handle filenames without directory', () => {
            const result = shell.exec('basename test.txt');
            expect(result).to.equal('test.txt');
        });
    });

    describe('dirname command', () => {
        it('should extract directory from path', () => {
            const result = shell.exec('dirname /tmp/test.txt');
            expect(result).to.equal('/tmp');
        });

        it('should return . for files without directory', () => {
            const result = shell.exec('dirname test.txt');
            expect(result).to.equal('.');
        });

        it('should handle multiple paths', () => {
            const result = shell.exec('dirname /tmp/test.txt /home/user/file.js');
            const lines = result.split('\n');
            expect(lines[0]).to.equal('/tmp');
            expect(lines[1]).to.equal('/home/user');
        });
    });

    describe('node -e command', () => {
        it('should execute inline code', () => {
            const result = shell.exec('node -e "console.log(1+1)"');
            expect(result).to.equal('2');
        });

        it('should support console.log output', () => {
            const result = shell.exec('node -e "console.log(\'hello\')"');
            expect(result).to.equal('hello');
        });

        it('should have access to filesystem', () => {
            fs.createFile('data.txt', 'test content');
            const result = shell.exec('node -e "const fs = require(\'fs\'); console.log(fs.readFileSync(\'/data.txt\', \'utf8\'))"');
            expect(result).to.include('test content');
        });

        it('should work with file execution too', () => {
            fs.createFile('script.js', 'console.log("from file")');
            const result = shell.exec('node script.js');
            expect(result).to.equal('from file');
        });
    });

    describe('command pipelines', () => {
        beforeEach(() => {
            fs.createFile('numbers.txt', '5\n2\n8\n1\n9');
        });

        it('should pipe head to sort', () => {
            fs.createFile('lines.txt', 'z\na\nm\nb\nc');
            const result = shell.exec('head -n 3 lines.txt | sort');
            expect(result).to.include('a');
            expect(result).to.include('m');
            expect(result).to.include('z');
        });

        it('should chain multiple commands', () => {
            fs.createFile('data.txt', 'apple\nbanana\napple\ncherry\nbanana');
            const result = shell.exec('cat data.txt | sort | uniq -c');
            expect(result).to.include('apple');
            expect(result).to.include('banana');
        });
    });

    describe('input redirection <', () => {
        it('should read from file and pass to command', () => {
            fs.createFile('input.txt', 'line1\nline2\nline3');
            const result = shell.exec('cat < input.txt');
            expect(result).to.equal('line1\nline2\nline3');
        });

        it('should work with wc command', () => {
            fs.createFile('data.txt', 'hello world\nfoo bar');
            const result = shell.exec('wc -l < data.txt');
            expect(result).to.include('2');
        });

        it('should throw error for non-existent file', () => {
            expect(() => shell.exec('cat < nonexistent.txt')).to.throw();
        });

        it('should work with pipes after input redirection', () => {
            fs.createFile('unsorted.txt', '3\n1\n2');
            const result = shell.exec('cat < unsorted.txt | sort -n');
            const lines = result.split('\n');
            expect(lines[0]).to.equal('1');
            expect(lines[1]).to.equal('2');
            expect(lines[2]).to.equal('3');
        });
    });

    describe('output redirection >', () => {
        it('should redirect output to file', () => {
            shell.exec('echo "hello world" > output.txt');
            const file = fs.resolvePath('output.txt');
            expect(file).to.not.be.null;
            expect(file!.isFile()).to.be.true;
            expect((file as any).read()).to.equal('hello world');
        });

        it('should overwrite existing file', () => {
            fs.createFile('test.txt', 'old content');
            shell.exec('echo "new content" > test.txt');
            const file = fs.resolvePath('test.txt');
            expect((file as any).read()).to.equal('new content');
        });

        it('should work with piped commands', () => {
            shell.exec('echo "hello\nworld" | sort > sorted.txt');
            const file = fs.resolvePath('sorted.txt');
            expect((file as any).read()).to.include('hello');
            expect((file as any).read()).to.include('world');
        });
    });

    describe('output append redirection >>', () => {
        it('should append to file', () => {
            fs.createFile('log.txt', 'line1');
            shell.exec('echo "line2" >> log.txt');
            const file = fs.resolvePath('log.txt');
            const content = (file as any).read();
            expect(content).to.include('line1');
            expect(content).to.include('line2');
        });

        it('should create file if not exists', () => {
            shell.exec('echo "first line" >> newfile.txt');
            const file = fs.resolvePath('newfile.txt');
            expect(file).to.not.be.null;
            expect((file as any).read()).to.equal('first line');
        });
    });

    describe('combined redirections', () => {
        it('should handle input and output together', () => {
            fs.createFile('input.txt', '5\n2\n8\n1');
            shell.exec('sort -n < input.txt > output.txt');
            const file = fs.resolvePath('output.txt');
            const content = (file as any).read();
            expect(content).to.include('1');
            expect(content).to.include('2');
            expect(content).to.include('5');
            expect(content).to.include('8');
        });

        it('should handle multiple pipes with input/output redirection', () => {
            fs.createFile('words.txt', 'apple\nbanana\napple\napricot');
            shell.exec('cat < words.txt | sort | uniq > unique.txt');
            const file = fs.resolvePath('unique.txt');
            const content = (file as any).read();
            expect(content).to.include('apple');
            expect(content).to.include('banana');
            expect(content).to.include('apricot');
        });
    });
});
