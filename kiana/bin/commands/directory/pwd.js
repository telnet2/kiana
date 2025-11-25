"use strict";
/**
 * pwd - print working directory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pwd = pwd;
function pwd(context, args) {
    return context.fs.getCurrentDirectory();
}
