"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinnerWriter = exports.MultiWriter = exports.SSEWriter = exports.NullWriter = exports.BufferWriter = exports.StdoutWriter = void 0;
/**
 * Standard output writer - writes directly to process.stdout
 */
class StdoutWriter {
    write(chunk) {
        process.stdout.write(chunk);
    }
    writeLine(line) {
        process.stdout.write(line + '\n');
    }
    flush() {
        // stdout is unbuffered in Node.js, no-op
    }
}
exports.StdoutWriter = StdoutWriter;
/**
 * Buffer writer - accumulates output in memory
 * Useful for testing and capturing output
 */
class BufferWriter {
    constructor() {
        this.buffer = '';
    }
    write(chunk) {
        this.buffer += chunk;
    }
    writeLine(line) {
        this.buffer += line + '\n';
    }
    flush() {
        // Already in memory, no-op
    }
    /**
     * Get the accumulated output
     */
    getOutput() {
        return this.buffer;
    }
    /**
     * Clear the buffer
     */
    clear() {
        this.buffer = '';
    }
}
exports.BufferWriter = BufferWriter;
/**
 * Null writer - discards all output
 * Useful for silent operation
 */
class NullWriter {
    write(chunk) {
        // Discard
    }
    writeLine(line) {
        // Discard
    }
    flush() {
        // No-op
    }
}
exports.NullWriter = NullWriter;
/**
 * Server-Sent Events (SSE) writer
 * Formats output as SSE for HTTP streaming
 *
 * @example
 * const writer = new SSEWriter((event) => {
 *   response.write(`data: ${JSON.stringify(event)}\n\n`);
 * });
 */
class SSEWriter {
    constructor(eventCallback) {
        this.eventCallback = eventCallback;
        this.eventId = 0;
    }
    write(chunk) {
        this.sendEvent({
            id: String(this.eventId++),
            event: 'chunk',
            data: chunk,
        });
    }
    writeLine(line) {
        this.sendEvent({
            id: String(this.eventId++),
            event: 'line',
            data: line,
        });
    }
    flush() {
        this.sendEvent({
            id: String(this.eventId++),
            event: 'flush',
            data: '',
        });
    }
    /**
     * Send a custom event
     */
    sendEvent(event) {
        this.eventCallback(event);
    }
}
exports.SSEWriter = SSEWriter;
/**
 * Multi-writer - broadcasts to multiple writers
 * Useful for logging to both stdout and a file
 */
class MultiWriter {
    constructor(...writers) {
        this.writers = writers;
    }
    write(chunk) {
        for (const writer of this.writers) {
            writer.write(chunk);
        }
    }
    writeLine(line) {
        for (const writer of this.writers) {
            writer.writeLine(line);
        }
    }
    flush() {
        for (const writer of this.writers) {
            if (writer.flush) {
                writer.flush();
            }
        }
    }
    /**
     * Add a writer to the broadcast list
     */
    addWriter(writer) {
        this.writers.push(writer);
    }
    /**
     * Remove a writer from the broadcast list
     */
    removeWriter(writer) {
        const index = this.writers.indexOf(writer);
        if (index !== -1) {
            this.writers.splice(index, 1);
        }
    }
}
exports.MultiWriter = MultiWriter;
/**
 * Spinner writer - stops a spinner on first write then delegates to wrapped writer
 * Useful for showing activity indicator while waiting for async operation
 */
class SpinnerWriter {
    constructor(innerWriter, spinner) {
        this.spinnerStopped = false;
        this.innerWriter = innerWriter;
        this.spinner = spinner;
    }
    stopSpinner() {
        if (!this.spinnerStopped && this.spinner && this.spinner.isRunning) {
            this.spinnerStopped = true;
            this.spinner.stop();
        }
    }
    write(chunk) {
        this.stopSpinner();
        this.innerWriter.write(chunk);
    }
    writeLine(line) {
        this.stopSpinner();
        this.innerWriter.writeLine(line);
    }
    flush() {
        if (this.innerWriter.flush) {
            this.innerWriter.flush();
        }
    }
}
exports.SpinnerWriter = SpinnerWriter;
