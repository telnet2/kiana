/**
 * Writer interface for streaming output
 * Supports multiple backends: stdout, SSE, buffer, etc.
 */
export interface Writer {
    /**
     * Write a chunk of text without newline
     */
    write(chunk: string): void;

    /**
     * Write a line of text with newline
     */
    writeLine(line: string): void;

    /**
     * Optional flush method for buffered writers
     */
    flush?(): void;
}

/**
 * Standard output writer - writes directly to process.stdout
 */
export class StdoutWriter implements Writer {
    write(chunk: string): void {
        process.stdout.write(chunk);
    }

    writeLine(line: string): void {
        process.stdout.write(line + '\n');
    }

    flush(): void {
        // stdout is unbuffered in Node.js, no-op
    }
}

/**
 * Buffer writer - accumulates output in memory
 * Useful for testing and capturing output
 */
export class BufferWriter implements Writer {
    private buffer: string;

    constructor() {
        this.buffer = '';
    }

    write(chunk: string): void {
        this.buffer += chunk;
    }

    writeLine(line: string): void {
        this.buffer += line + '\n';
    }

    flush(): void {
        // Already in memory, no-op
    }

    /**
     * Get the accumulated output
     */
    getOutput(): string {
        return this.buffer;
    }

    /**
     * Clear the buffer
     */
    clear(): void {
        this.buffer = '';
    }
}

/**
 * Null writer - discards all output
 * Useful for silent operation
 */
export class NullWriter implements Writer {
    write(chunk: string): void {
        // Discard
    }

    writeLine(line: string): void {
        // Discard
    }

    flush(): void {
        // No-op
    }
}

/**
 * Server-Sent Events (SSE) writer
 * Formats output as SSE for HTTP streaming
 *
 * @example
 * const writer = new SSEWriter((event) => {
 *   response.write(`data: ${JSON.stringify(event)}\n\n`);
 * });
 */
export class SSEWriter implements Writer {
    private eventCallback: (event: SSEEvent) => void;
    private eventId: number;

    constructor(eventCallback: (event: SSEEvent) => void) {
        this.eventCallback = eventCallback;
        this.eventId = 0;
    }

    write(chunk: string): void {
        this.sendEvent({
            id: String(this.eventId++),
            event: 'chunk',
            data: chunk,
        });
    }

    writeLine(line: string): void {
        this.sendEvent({
            id: String(this.eventId++),
            event: 'line',
            data: line,
        });
    }

    flush(): void {
        this.sendEvent({
            id: String(this.eventId++),
            event: 'flush',
            data: '',
        });
    }

    /**
     * Send a custom event
     */
    sendEvent(event: SSEEvent): void {
        this.eventCallback(event);
    }
}

/**
 * Server-Sent Event structure
 */
export interface SSEEvent {
    id?: string;
    event: string;
    data: string;
}

/**
 * Multi-writer - broadcasts to multiple writers
 * Useful for logging to both stdout and a file
 */
export class MultiWriter implements Writer {
    private writers: Writer[];

    constructor(...writers: Writer[]) {
        this.writers = writers;
    }

    write(chunk: string): void {
        for (const writer of this.writers) {
            writer.write(chunk);
        }
    }

    writeLine(line: string): void {
        for (const writer of this.writers) {
            writer.writeLine(line);
        }
    }

    flush(): void {
        for (const writer of this.writers) {
            if (writer.flush) {
                writer.flush();
            }
        }
    }

    /**
     * Add a writer to the broadcast list
     */
    addWriter(writer: Writer): void {
        this.writers.push(writer);
    }

    /**
     * Remove a writer from the broadcast list
     */
    removeWriter(writer: Writer): void {
        const index = this.writers.indexOf(writer);
        if (index !== -1) {
            this.writers.splice(index, 1);
        }
    }
}

/**
 * Spinner writer - stops a spinner on first write then delegates to wrapped writer
 * Useful for showing activity indicator while waiting for async operation
 */
export class SpinnerWriter implements Writer {
    private innerWriter: Writer;
    private spinner: any; // Reference to Spinner instance
    private spinnerStopped = false;

    constructor(innerWriter: Writer, spinner: any) {
        this.innerWriter = innerWriter;
        this.spinner = spinner;
    }

    private stopSpinner(): void {
        if (!this.spinnerStopped && this.spinner && this.spinner.isRunning) {
            this.spinnerStopped = true;
            this.spinner.stop();
        }
    }

    write(chunk: string): void {
        this.stopSpinner();
        this.innerWriter.write(chunk);
    }

    writeLine(line: string): void {
        this.stopSpinner();
        this.innerWriter.writeLine(line);
    }

    flush(): void {
        if (this.innerWriter.flush) {
            this.innerWriter.flush();
        }
    }
}
