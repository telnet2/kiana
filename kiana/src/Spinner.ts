/**
 * Simple spinner for visual feedback during async operations
 */
export class Spinner {
    private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private currentFrame = 0;
    private interval: NodeJS.Timeout | null = null;
    private active = false;

    /**
     * Start the spinner
     */
    start(): void {
        if (this.active) {
            return;
        }

        this.active = true;
        this.currentFrame = 0;
        process.stdout.write(this.frames[this.currentFrame]);

        this.interval = setInterval(() => {
            if (!this.active) return;

            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            // Backspace + next frame
            process.stdout.write('\b' + this.frames[this.currentFrame]);
        }, 80);
    }

    /**
     * Stop the spinner and clear it
     */
    stop(): void {
        if (!this.active) {
            return;
        }

        this.active = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        // Clear the spinner character
        process.stdout.write('\b \b');
    }

    /**
     * Check if spinner is running
     */
    isRunning(): boolean {
        return this.active;
    }

    /**
     * Alternative: show spinner with message
     */
    startWithMessage(message: string): void {
        process.stdout.write(message);
        this.start();
    }

    /**
     * Stop spinner and replace with text
     */
    stopWithMessage(message: string): void {
        this.stop();
        process.stdout.write(message);
    }
}
