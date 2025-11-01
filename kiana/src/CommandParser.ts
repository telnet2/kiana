export type PipelineSeparator = 'pipe' | 'and' | 'or' | 'seq' | 'end';

export interface PipelineSegment {
    type: PipelineSeparator;
    command: string[];
}

export type RedirectionType = '>' | '>>' | '<' | '2>' | '&>' | '>&' | '<<';

export interface StandardRedirection {
    type: '>' | '>>' | '<' | '2>' | '&>' | '>&';
    target: string;
}

export interface HeredocRedirection {
    type: '<<';
    delimiter: string;
}

export type Redirection = StandardRedirection | HeredocRedirection;

export interface HeredocParseResult {
    hasHeredoc: true;
    command: string;
    delimiter: string;
    content: string | null;
}

export interface HeredocContentResult {
    command: string;
    content: string;
    endIndex: number;
}

export interface InlineHeredocResult {
    command: string;
    content: string;
    redirect: string | null;
    preRedirects: Redirection[];
}

export function tokenize(commandLine: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < commandLine.length; i += 1) {
        const char = commandLine[i];

        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\' && !inSingleQuote) {
            escaped = true;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (char === '|') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                if (i + 1 < commandLine.length && commandLine[i + 1] === '|') {
                    tokens.push('||');
                    i += 1;
                } else {
                    tokens.push('|');
                }
                continue;
            }

            if (char === '>') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                if (i + 1 < commandLine.length) {
                    const nextChar = commandLine[i + 1];
                    if (nextChar === '>') {
                        tokens.push('>>');
                        i += 1;
                        continue;
                    }
                    if (nextChar === '&') {
                        tokens.push('>&');
                        i += 1;
                        continue;
                    }
                }
                tokens.push('>');
                continue;
            }

            if (char === '<') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                if (i + 1 < commandLine.length && commandLine[i + 1] === '<') {
                    tokens.push('<<');
                    i += 1;
                    continue;
                }
                tokens.push('<');
                continue;
            }

            if (char === '2' && i + 1 < commandLine.length && commandLine[i + 1] === '>') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                tokens.push('2>');
                i += 1;
                continue;
            }

            if (char === '&' && i + 1 < commandLine.length) {
                const nextChar = commandLine[i + 1];
                if (nextChar === '&') {
                    if (current) {
                        tokens.push(current);
                        current = '';
                    }
                    tokens.push('&&');
                    i += 1;
                    continue;
                }
                if (nextChar === '>') {
                    if (current) {
                        tokens.push(current);
                        current = '';
                    }
                    tokens.push('&>');
                    i += 1;
                    continue;
                }
            }

            if (char === ' ' || char === '\t') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                continue;
            }

            if (char === ';') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                tokens.push(';');
                continue;
            }
        }

        current += char;
    }

    if (current) {
        tokens.push(current);
    }

    return tokens;
}

export function parsePipeline(commandLine: string): PipelineSegment[] {
    const tokens = tokenize(commandLine);
    const commands: PipelineSegment[] = [];
    let currentCommand: string[] = [];

    for (const token of tokens) {
        if (token === '|') {
            if (currentCommand.length > 0) {
                commands.push({ type: 'pipe', command: currentCommand });
                currentCommand = [];
            }
        } else if (token === '&&') {
            if (currentCommand.length > 0) {
                commands.push({ type: 'and', command: currentCommand });
                currentCommand = [];
            }
        } else if (token === '||') {
            if (currentCommand.length > 0) {
                commands.push({ type: 'or', command: currentCommand });
                currentCommand = [];
            }
        } else if (token === ';') {
            if (currentCommand.length > 0) {
                commands.push({ type: 'seq', command: currentCommand });
                currentCommand = [];
            }
        } else {
            currentCommand.push(token);
        }
    }

    if (currentCommand.length > 0) {
        commands.push({ type: 'end', command: currentCommand });
    }

    return commands;
}

export function parseRedirections(tokens: string[]): { command: string[]; redirections: Redirection[] } {
    const command: string[] = [];
    const redirections: Redirection[] = [];

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];

        if (token === '>' || token === '>>' || token === '<' || token === '2>' || token === '&>' || token === '>&') {
            if (i + 1 < tokens.length) {
                redirections.push({
                    type: token,
                    target: tokens[i + 1],
                });
                i += 1;
            }
        } else if (token === '<<') {
            if (i + 1 < tokens.length) {
                redirections.push({
                    type: '<<',
                    delimiter: tokens[i + 1],
                });
                i += 1;
            }
        } else {
            command.push(token);
        }
    }

    return { command, redirections };
}

export function parseHeredoc(commandLine: string): HeredocParseResult | null {
    const heredocMatch = commandLine.match(/^(.+?)\s*<<\s*(\S+)\s*$/m);

    if (!heredocMatch) {
        return null;
    }

    const command = heredocMatch[1].trim();
    const delimiter = heredocMatch[2];

    return {
        hasHeredoc: true,
        command,
        delimiter,
        content: null,
    };
}

export function parseHeredocContent(lines: string[], startIndex = 0): HeredocContentResult | null {
    if (startIndex >= lines.length) {
        return null;
    }

    const firstLine = lines[startIndex];
    const heredocInfo = parseHeredoc(firstLine);

    if (!heredocInfo) {
        return null;
    }

    const content: string[] = [];
    let i = startIndex + 1;

    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === heredocInfo.delimiter) {
            return {
                command: heredocInfo.command,
                content: content.join('\n'),
                endIndex: i,
            };
        }
        content.push(line);
        i += 1;
    }

    return {
        command: heredocInfo.command,
        content: content.join('\n'),
        endIndex: lines.length - 1,
    };
}

export function isInlineHeredoc(commandLine: string): boolean {
    return commandLine.includes('<<') && commandLine.includes('\n');
}

export function parseInlineHeredoc(commandLine: string): InlineHeredocResult | null {
    const heredocMatch = commandLine.match(/^(.+?)\s*<<\s*(\S+)\s*\n([\s\S]*?)^\2$/m);

    if (heredocMatch) {
        let content = heredocMatch[3];
        if (content.endsWith('\n')) {
            content = content.slice(0, -1);
        }

        const beforeHeredoc = heredocMatch[1].trim();
        const tokens = tokenize(beforeHeredoc);
        const { command: cmdTokens, redirections: preRedirects } = parseRedirections(tokens);

        return {
            command: cmdTokens.join(' '),
            content,
            redirect: null,
            preRedirects,
        };
    }

    const simpleMatch = commandLine.match(/^(.+?)\s*<<\s*(\S+)(.*)?\n([\s\S]+)$/);
    if (simpleMatch) {
        const beforeHeredoc = simpleMatch[1].trim();
        const delimiter = simpleMatch[2];
        const firstLineRest = simpleMatch[3] ? simpleMatch[3].trim() : '';
        const content = simpleMatch[4];
        const lines = content.split('\n');

        const tokens = tokenize(beforeHeredoc);
        const { command: cmdTokens, redirections: preRedirects } = parseRedirections(tokens);

        let delimiterIndex = -1;
        let delimiterLineRest = '';
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            if (line === delimiter) {
                delimiterIndex = i;
                break;
            }
            if (line.startsWith(`${delimiter} `) || line.startsWith(`${delimiter}\t`)) {
                delimiterIndex = i;
                const delimiterEnd = line.indexOf(delimiter) + delimiter.length;
                delimiterLineRest = line.substring(delimiterEnd).trim();
                break;
            }
        }

        const actualContent = delimiterIndex >= 0 ? lines.slice(0, delimiterIndex).join('\n') : content;

        let finalRedirect: string | null = null;
        if (firstLineRest && delimiterLineRest) {
            finalRedirect = `${firstLineRest} ${delimiterLineRest}`;
        } else if (firstLineRest) {
            finalRedirect = firstLineRest;
        } else if (delimiterLineRest) {
            finalRedirect = delimiterLineRest;
        }

        return {
            command: cmdTokens.join(' '),
            content: actualContent,
            redirect: finalRedirect,
            preRedirects,
        };
    }

    return null;
}
