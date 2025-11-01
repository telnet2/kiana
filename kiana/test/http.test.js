const { expect } = require('chai');
const { MemShell } = require('../lib/MemShell');

describe('http command - stdin piping and HEREDOC', () => {
    let shell;
    let lastRequest;

    beforeEach(() => {
        shell = new MemShell();
        lastRequest = null;
        // Mock global.fetch for http command
        global.fetch = async (url, options = {}) => {
            lastRequest = { url, options };
            // Minimal Headers-like object with forEach
            const headers = {
                forEach: (cb) => {
                    cb('text/plain', 'content-type');
                },
            };
            const body = options.body || '';
            return {
                status: 200,
                statusText: 'OK',
                headers,
                text: async () => body,
            };
        };
    });

    it('should accept stdin via pipe as request body', () => {
        const output = shell.exec('echo "hello world" | http POST http://example.org/echo');
        expect(lastRequest).to.not.be.null;
        expect(lastRequest.options.method).to.equal('POST');
        expect(lastRequest.options.body).to.equal('hello world');
        expect(output).to.include('HTTP/1.1 200 OK');
        expect(output).to.include('content-type: text/plain');
        expect(output).to.include('hello world');
    });

    it('should accept HEREDOC content as stdin for request body', () => {
        const output = shell.exec(`http POST http://example.org/echo << EOF\nline1\nline2\nEOF`);
        expect(lastRequest).to.not.be.null;
        expect(lastRequest.options.method).to.equal('POST');
        expect(lastRequest.options.body).to.include('line1');
        expect(lastRequest.options.body).to.include('line2');
        expect(output).to.include('HTTP/1.1 200 OK');
        expect(output).to.include('content-type: text/plain');
        expect(output).to.include('line1');
        expect(output).to.include('line2');
    });

    it('should accept stdin when using --raw', () => {
        const output = shell.exec('echo "RAW BODY" | http --raw POST http://example.org/raw');
        expect(lastRequest).to.not.be.null;
        expect(lastRequest.options.method).to.equal('POST');
        expect(lastRequest.options.body).to.equal('RAW BODY');
        expect(output).to.include('HTTP/1.1 200 OK');
        expect(output).to.include('RAW BODY');
    });
});