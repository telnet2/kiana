const { expect } = require('chai');
const { tokenize, parsePipeline, parseHeredoc, parseInlineHeredoc, isInlineHeredoc } = require('../lib/CommandParser');

describe('CommandParser', () => {
    describe('tokenize', () => {
        it('should tokenize simple command', () => {
            const tokens = tokenize('cat file.txt');
            expect(tokens).to.deep.equal(['cat', 'file.txt']);
        });

        it('should tokenize command with flags', () => {
            const tokens = tokenize('ls -la /tmp');
            expect(tokens).to.deep.equal(['ls', '-la', '/tmp']);
        });

        it('should handle single quotes', () => {
            const tokens = tokenize("echo 'hello world'");
            expect(tokens).to.deep.equal(['echo', 'hello world']);
        });

        it('should handle double quotes', () => {
            const tokens = tokenize('echo "hello world"');
            expect(tokens).to.deep.equal(['echo', 'hello world']);
        });

        it('should handle escaped characters', () => {
            const tokens = tokenize('echo hello\\ world');
            expect(tokens).to.deep.equal(['echo', 'hello world']);
        });

        it('should handle pipe character', () => {
            const tokens = tokenize('cat file.txt | grep error');
            expect(tokens).to.deep.equal(['cat', 'file.txt', '|', 'grep', 'error']);
        });

        it('should handle multiple pipes', () => {
            const tokens = tokenize('cat file.txt | grep error | sed s/a/b/g');
            expect(tokens).to.deep.equal(['cat', 'file.txt', '|', 'grep', 'error', '|', 'sed', 's/a/b/g']);
        });

        it('should handle tabs as whitespace', () => {
            const tokens = tokenize('cat\tfile.txt');
            expect(tokens).to.deep.equal(['cat', 'file.txt']);
        });
    });

    describe('parsePipeline', () => {
        it('should parse single command', () => {
            const pipeline = parsePipeline('cat file.txt');
            expect(pipeline).to.have.lengthOf(1);
            expect(pipeline[0].command).to.deep.equal(['cat', 'file.txt']);
            expect(pipeline[0].type).to.equal('end');
        });

        it('should parse two commands with pipe', () => {
            const pipeline = parsePipeline('cat file.txt | grep error');
            expect(pipeline).to.have.lengthOf(2);
            expect(pipeline[0].command).to.deep.equal(['cat', 'file.txt']);
            expect(pipeline[0].type).to.equal('pipe');
            expect(pipeline[1].command).to.deep.equal(['grep', 'error']);
            expect(pipeline[1].type).to.equal('end');
        });

        it('should parse three commands with pipes', () => {
            const pipeline = parsePipeline('cat file.txt | grep error | sed s/a/b/g');
            expect(pipeline).to.have.lengthOf(3);
            expect(pipeline[0].command).to.deep.equal(['cat', 'file.txt']);
            expect(pipeline[0].type).to.equal('pipe');
            expect(pipeline[1].command).to.deep.equal(['grep', 'error']);
            expect(pipeline[1].type).to.equal('pipe');
            expect(pipeline[2].command).to.deep.equal(['sed', 's/a/b/g']);
            expect(pipeline[2].type).to.equal('end');
        });

        it('should handle quoted strings in pipeline', () => {
            const pipeline = parsePipeline('echo "hello world" | grep hello');
            expect(pipeline).to.have.lengthOf(2);
            expect(pipeline[0].command).to.deep.equal(['echo', 'hello world']);
            expect(pipeline[0].type).to.equal('pipe');
            expect(pipeline[1].command).to.deep.equal(['grep', 'hello']);
            expect(pipeline[1].type).to.equal('end');
        });
    });

    describe('parseHeredoc', () => {
        it('should detect HEREDOC', () => {
            const result = parseHeredoc('cat << EOF');
            expect(result).to.not.be.null;
            expect(result.command).to.equal('cat');
            expect(result.delimiter).to.equal('EOF');
        });

        it('should detect HEREDOC with different delimiter', () => {
            const result = parseHeredoc('grep error << END');
            expect(result).to.not.be.null;
            expect(result.command).to.equal('grep error');
            expect(result.delimiter).to.equal('END');
        });

        it('should return null for non-HEREDOC command', () => {
            const result = parseHeredoc('cat file.txt');
            expect(result).to.be.null;
        });

        it('should handle extra whitespace', () => {
            const result = parseHeredoc('cat  <<  EOF');
            expect(result).to.not.be.null;
            expect(result.command).to.equal('cat');
            expect(result.delimiter).to.equal('EOF');
        });
    });

    describe('isInlineHeredoc', () => {
        it('should detect inline HEREDOC', () => {
            const result = isInlineHeredoc('cat << EOF\nline1\nEOF');
            expect(result).to.be.true;
        });

        it('should return false for regular command', () => {
            const result = isInlineHeredoc('cat file.txt');
            expect(result).to.be.false;
        });

        it('should return false for HEREDOC without content', () => {
            const result = isInlineHeredoc('cat << EOF');
            expect(result).to.be.false;
        });
    });

    describe('parseInlineHeredoc', () => {
        it('should parse inline HEREDOC', () => {
            const result = parseInlineHeredoc('cat << EOF\nline1\nline2\nEOF');
            expect(result).to.not.be.null;
            expect(result.command).to.equal('cat');
            expect(result.content).to.equal('line1\nline2');
        });

        it('should parse inline HEREDOC with different delimiter', () => {
            const result = parseInlineHeredoc('grep test << END\nline1\ntest line\nEND');
            expect(result).to.not.be.null;
            expect(result.command).to.equal('grep test');
            expect(result.content).to.equal('line1\ntest line');
        });

        it('should return null for non-inline HEREDOC', () => {
            const result = parseInlineHeredoc('cat file.txt');
            expect(result).to.be.null;
        });

        it('should handle content with empty lines', () => {
            const result = parseInlineHeredoc('cat << EOF\nline1\n\nline3\nEOF');
            expect(result).to.not.be.null;
            expect(result.content).to.equal('line1\n\nline3');
        });
    });
});
