"use strict";
/**
 * vim - Edit files interactively using vim
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vim = vim;
const child_process_1 = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const argparse_1 = require("argparse");
const MemFS_1 = require("../../MemFS");
function vim(context, args) {
    const parser = new argparse_1.ArgumentParser({
        prog: 'vim',
        description: 'Edit file using vim editor',
        add_help: true,
    });
    parser.add_argument('file', { help: 'File to edit (in memFS)' });
    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string')
        return parsed; // Help text
    const filePath = parsed.file;
    // Resolve the file path in memFS
    let node = context.fs.resolvePath(filePath);
    let fileContent = '';
    // If file exists, read it
    if (node) {
        if (!node.isFile()) {
            throw new Error(`vim: '${filePath}' is a directory`);
        }
        fileContent = node.read();
    }
    else {
        // File doesn't exist yet, will create it after editing
        fileContent = '';
    }
    // Create a temporary file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `vim_${Date.now()}_${Math.random().toString(36).substring(7)}.tmp`);
    try {
        // Write current content to temp file
        fs.writeFileSync(tempFile, fileContent, 'utf-8');
        // Spawn vim with stdio: 'inherit' so it can interact with the terminal
        const result = (0, child_process_1.spawnSync)('vim', [tempFile], {
            stdio: 'inherit',
        });
        if (result.error) {
            throw new Error(`vim: ${result.error.message}`);
        }
        // Read the modified content
        const modifiedContent = fs.readFileSync(tempFile, 'utf-8');
        // Update or create the file in memFS
        if (node) {
            if (node instanceof MemFS_1.MemFile) {
                node.write(modifiedContent);
            }
        }
        else {
            context.fs.createFile(filePath, modifiedContent);
        }
        return '';
    }
    finally {
        // Clean up temp file
        try {
            fs.unlinkSync(tempFile);
        }
        catch {
            // Ignore cleanup errors
        }
    }
}
