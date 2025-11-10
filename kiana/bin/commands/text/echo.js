"use strict";
/**
 * echo - display a line of text
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.echo = echo;
function echo(context, args) {
    return args.join(' ');
}
