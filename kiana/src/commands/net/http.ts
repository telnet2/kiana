/**
 * http - HTTPie-like command for making HTTP requests
 */

import { ArgumentParser } from 'argparse';
import { CommandContext } from '../types';

interface HeaderMap { [key: string]: string }

function trimQuotes(s: string): string {
    if (!s) return s;
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
}

function parseRequestItems(items: string[], context: CommandContext) {
    const headers: HeaderMap = {};
    const params: Record<string, string> = {};
    const dataFields: Record<string, any> = {};
    const formFields: Record<string, string> = {};
    const fileFields: Array<{ name: string; filename: string; content: string; contentType?: string }> = [];

    for (const raw of items) {
        const item = trimQuotes(raw);

        // ':=@' raw JSON field from file
        const idxJsonFile = item.indexOf(':=@');
        if (idxJsonFile > 0) {
            const name = item.slice(0, idxJsonFile).replace(/\\:/g, ':');
            const path = item.slice(idxJsonFile + 3);
            const node = context.fs.resolvePath(path);
            if (!node || !node.isFile()) {
                throw new Error(`http: ${path}: No such file`);
            }
            const content = node.read();
            try {
                dataFields[name] = JSON.parse(content);
            } catch (e) {
                throw new Error(`http: ${path}: Invalid JSON content`);
            }
            continue;
        }

        // '=@' data field from file (string)
        const idxDataFile = item.indexOf('=@');
        if (idxDataFile > 0) {
            const name = item.slice(0, idxDataFile).replace(/\\:/g, ':');
            const path = item.slice(idxDataFile + 2);
            const node = context.fs.resolvePath(path);
            if (!node || !node.isFile()) {
                throw new Error(`http: ${path}: No such file`);
            }
            const content = node.read();
            dataFields[name] = content;
            continue;
        }

        // ':=' non-string JSON field
        const idxJson = item.indexOf(':=');
        if (idxJson > 0) {
            const name = item.slice(0, idxJson).replace(/\\:/g, ':');
            const valueRaw = item.slice(idxJson + 2);
            try {
                dataFields[name] = JSON.parse(valueRaw);
            } catch (e) {
                throw new Error(`http: invalid JSON for field '${name}'`);
            }
            continue;
        }

        // '==' URL parameter
        const idxParam = item.indexOf('==');
        if (idxParam > 0) {
            const name = item.slice(0, idxParam).replace(/\\:/g, ':');
            const value = item.slice(idxParam + 2);
            params[name] = value;
            continue;
        }

        // ':' header
        const idxHeader = item.indexOf(':');
        if (idxHeader > 0 && !item.includes('://')) {
            const name = item.slice(0, idxHeader).replace(/\\:/g, ':');
            const value = item.slice(idxHeader + 1);
            headers[name] = value;
            continue;
        }

        // '@' form file field: name@path[;type=...]
        const idxFormFile = item.indexOf('@');
        if (idxFormFile > 0) {
            const name = item.slice(0, idxFormFile);
            const rest = item.slice(idxFormFile + 1);
            const [pathPart, typePart] = rest.split(';');
            const node = context.fs.resolvePath(pathPart);
            if (!node || !node.isFile()) {
                throw new Error(`http: ${pathPart}: No such file`);
            }
            const contentType = typePart && typePart.startsWith('type=') ? typePart.slice(5) : undefined;
            fileFields.push({ name, filename: node.name, content: node.read(), contentType });
            continue;
        }

        // '=' data field
        const idxData = item.indexOf('=');
        if (idxData > 0) {
            const name = item.slice(0, idxData).replace(/\\:/g, ':');
            const value = item.slice(idxData + 1);
            dataFields[name] = value;
            continue;
        }

        // If none matched, ignore (could be a stray token)
    }

    return { headers, params, dataFields, formFields, fileFields };
}

function applyDefaultScheme(url: string, defaultScheme: 'http' | 'https'): string {
    const trimmed = trimQuotes(url);

    // localhost shorthand
    if (trimmed.startsWith(':')) {
        if (trimmed === ':') return `${defaultScheme}://localhost`;
        if (trimmed.startsWith(':/')) return `${defaultScheme}://localhost${trimmed.slice(1)}`;
        // :3000 or :8080/path
        return `${defaultScheme}://localhost${trimmed}`;
    }

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        return trimmed; // has scheme
    }
    return `${defaultScheme}://${trimmed}`;
}

export function http(context: CommandContext, args: string[], stdin: string | null = null): string {
    const parser = new ArgumentParser({
        prog: 'http',
        description: 'HTTPie-like command-line HTTP client',
        add_help: true,
    });

    parser.add_argument('method', { nargs: '?', help: 'HTTP method' });
    parser.add_argument('url', { help: 'Request URL' });
    parser.add_argument('items', { nargs: '*', help: 'Request items' });

    // Predefined content types
    parser.add_argument('--json', '-j', { action: 'store_true', help: 'Serialize data items as JSON' });
    parser.add_argument('--form', '-f', { action: 'store_true', help: 'Serialize data items as form fields' });
    parser.add_argument('--multipart', { action: 'store_true', help: 'Force multipart/form-data request' });
    parser.add_argument('--boundary', { help: 'Custom boundary for multipart/form-data (ignored)' });

    // Raw
    parser.add_argument('--raw', { nargs: '?', help: 'Raw request data (or read from stdin/file)' });

    // URL scheme
    parser.add_argument('--default-scheme', { choices: ['http', 'https'], default: 'http', dest: 'default_scheme' });

    // Output
    parser.add_argument('--output', '-o', { help: 'Save output to FILE' });
    parser.add_argument('--download', '-d', { action: 'store_true', help: 'Download response body to file' });
    parser.add_argument('--continue', '-c', { action: 'store_true', dest: 'continue_flag', help: 'Resume interrupted download' });
    parser.add_argument('--quiet', '-q', { action: 'store_true', help: 'Quiet mode' });

    const parsed = context.parseArgsWithHelp(parser, args);
    if (typeof parsed === 'string') return parsed; // Help text

    let method: string | undefined = parsed.method ? String(parsed.method).toUpperCase() : undefined;
    let url: string = String(parsed.url);
    const items: string[] = Array.isArray(parsed.items) ? parsed.items : [];
    url = applyDefaultScheme(url, parsed.default_scheme);

    const { headers, params, dataFields, fileFields } = parseRequestItems(items, context);

    // Apply URL params
    if (Object.keys(params).length > 0) {
        const u = new URL(url);
        for (const [k, v] of Object.entries(params)) {
            u.searchParams.append(k, v);
        }
        url = u.toString();
    }

    // Determine body mode
    const isJsonMode = parsed.json || (!parsed.form && !parsed.multipart && !parsed.raw);
    const isFormMode = parsed.form || parsed.multipart;

    // Auto-select method
    const hasStructuredData = Object.keys(dataFields).length > 0 || fileFields.length > 0;
    let rawBodyFromFlag: string | null = parsed.raw !== undefined ? (parsed.raw ?? null) : null;

    // Heuristic: if --raw accidentally consumed the HTTP method token, fix it
    const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!method && rawBodyFromFlag && HTTP_METHODS.includes(rawBodyFromFlag.toUpperCase())) {
        method = rawBodyFromFlag.toUpperCase();
        rawBodyFromFlag = null; // treat as flag without value, allowing stdin to be used as body
    }

    let bodyString: string | null = null;

    // Handle raw body sources
    if (rawBodyFromFlag !== null) {
        // If provided and starts with '@', load from MemFS
        if (rawBodyFromFlag.startsWith('@')) {
            const p = rawBodyFromFlag.slice(1);
            const node = context.fs.resolvePath(p);
            if (!node || !node.isFile()) {
                throw new Error(`http: ${p}: No such file`);
            }
            bodyString = node.read();
        } else {
            bodyString = rawBodyFromFlag;
        }
    } else if (stdin && stdin.length > 0) {
        // Piped data implies raw
        bodyString = stdin;
    }

    // Build headers defaults
    const finalHeaders: HeaderMap = { ...headers };
    if (isJsonMode) {
        if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';
        if (!finalHeaders['Accept']) finalHeaders['Accept'] = 'application/json';
    } else if (isFormMode) {
        // Content-Type handled by fetch/FormData automatically; leave Accept unset
    }

    // Build request init
    let requestBody: any = null;
    let isMultipart = parsed.multipart || (fileFields.length > 0 && isFormMode);

    if (bodyString !== null) {
        requestBody = bodyString;
    } else if (isJsonMode && hasStructuredData) {
        requestBody = JSON.stringify(dataFields);
    } else if (isFormMode && hasStructuredData) {
        if (isMultipart) {
            // Use FormData for multipart
            const form = new (global as any).FormData();
            for (const [k, v] of Object.entries(dataFields)) {
                form.append(k, String(v));
            }
            for (const f of fileFields) {
                // Append as Blob-like; Node fetch supports string as Blob with filename via File if available
                const blob = new (global as any).Blob([f.content], { type: f.contentType || 'application/octet-stream' });
                // If File constructor exists, use it to set filename
                if ((global as any).File) {
                    const fileObj = new (global as any).File([blob], f.filename, { type: f.contentType || 'application/octet-stream' });
                    (form as any).append(f.name, fileObj);
                } else {
                    (form as any).append(f.name, blob, f.filename);
                }
            }
            requestBody = form;
            // Let fetch set Content-Type with boundary automatically
            delete finalHeaders['Content-Type'];
        } else {
            // x-www-form-urlencoded
            const usp = new URLSearchParams();
            for (const [k, v] of Object.entries(dataFields)) {
                usp.append(k, String(v));
            }
            requestBody = usp.toString();
            if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
    }

    if (!method) {
        method = (requestBody !== null) ? 'POST' : 'GET';
    }

    // Perform fetch asynchronously and wait synchronously
    let output = '';
    let error: Error | null = null;
    let completed = false;

    (async () => {
        try {
            // Handle resume: set Range header if output file exists
            let existingSize = 0;
            let outputPath: string | null = parsed.output ?? null;
            if (parsed.download && !outputPath) {
                // Guess filename from URL
                const u = new URL(url);
                const pathname = u.pathname;
                const base = pathname.split('/').filter(Boolean).pop() || 'download';
                outputPath = base;
            }

            if (parsed.continue_flag && outputPath) {
                const existing = context.fs.resolvePath(outputPath);
                if (existing && existing.isFile()) {
                    existingSize = existing.size();
                    if (existingSize > 0) {
                        finalHeaders['Range'] = `bytes=${existingSize}-`;
                    }
                }
            }

            const res = await (global as any).fetch(url, {
                method,
                headers: finalHeaders,
                body: requestBody,
            } as any);

            // Build response output
            const statusLine = `HTTP/1.1 ${res.status} ${res.statusText}`;
            const headerLines: string[] = [];
            (res.headers as any).forEach((value: string, key: string) => {
                headerLines.push(`${key}: ${value}`);
            });

            const bodyText = await res.text();

            const fullOutput = [statusLine, ...headerLines, '', bodyText].join('\n');

            // Handle download/output options
            if (outputPath) {
                // Ensure parent directories exist if specified
                // MemFS.createFile uses current cwd for relative paths
                const existing = context.fs.resolvePath(outputPath);
                if (parsed.download) {
                    // Save only body
                    if (existing && existing.isFile() && parsed.continue_flag && existingSize > 0) {
                        existing.append(bodyText);
                    } else if (existing && existing.isFile() && !parsed.continue_flag) {
                        existing.write(bodyText);
                    } else {
                        context.fs.createFile(outputPath, bodyText);
                    }
                } else {
                    // Save full output
                    if (existing && existing.isFile()) {
                        existing.write(fullOutput);
                    } else {
                        context.fs.createFile(outputPath, fullOutput);
                    }
                }
                output = ''; // redirect stdout
            } else if (parsed.download) {
                // Save to guessed filename
                const u = new URL(url);
                const pathname = u.pathname;
                const base = pathname.split('/').filter(Boolean).pop() || 'download';
                const existing = context.fs.resolvePath(base);
                if (existing && existing.isFile() && parsed.continue_flag && existingSize > 0) {
                    existing.append(bodyText);
                } else if (existing && existing.isFile() && !parsed.continue_flag) {
                    existing.write(bodyText);
                } else {
                    context.fs.createFile(base, bodyText);
                }
                output = '';
            } else {
                output = fullOutput;
            }
        } catch (err: any) {
            error = err instanceof Error ? err : new Error(String(err));
        } finally {
            completed = true;
        }
    })();

    const deasync = require('deasync');
    while (!completed && error === null) {
        deasync.runLoopOnce();
    }

    if (error) {
        throw error;
    }

    if (parsed.quiet) {
        return '';
    }

    return output;
}