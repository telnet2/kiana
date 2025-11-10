"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spinner = void 0;
/**
 * Simple spinner for visual feedback during async operations
 */
class Spinner {
    constructor() {
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.currentFrame = 0;
        this.interval = null;
        this.active = false;
    }
    /**
     * Start the spinner
     */
    start() {
        if (this.active) {
            return;
        }
        this.active = true;
        this.currentFrame = 0;
        process.stdout.write(this.frames[this.currentFrame]);
        this.interval = setInterval(() => {
            if (!this.active)
                return;
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            // Backspace + next frame
            process.stdout.write('\b' + this.frames[this.currentFrame]);
        }, 80);
    }
    /**
     * Stop the spinner and clear it
     */
    stop() {
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
    isRunning() {
        return this.active;
    }
    /**
     * Alternative: show spinner with message
     */
    startWithMessage(message) {
        process.stdout.write(message);
        this.start();
    }
    /**
     * Stop spinner and replace with text
     */
    stopWithMessage(message) {
        this.stop();
        process.stdout.write(message);
    }
}
exports.Spinner = Spinner;
