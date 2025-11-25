"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMemshChat = runMemshChat;
const ai_1 = require("ai");
const KianaAgentV6_1 = require("../KianaAgentV6");
const MemTools_1 = require("../MemTools");
const envLoader_1 = require("../envLoader");
const fs = require("node:fs");
function parseArgs(argv) {
    const out = { mode: 'local', maxRounds: 20, verbose: false };
    // Defaults from env
    const ark = (0, envLoader_1.getARKConfigFromEnv)();
    if (ark.apiKey)
        out.ark = ark;
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case '--server':
                out.mode = 'remote';
                out.serverUrl = argv[++i];
                break;
            case '--session':
                out.sessionId = argv[++i];
                break;
            case '--rounds':
                out.maxRounds = Number(argv[++i]);
                break;
            case '--system':
                {
                    const p = argv[++i];
                    try {
                        out.systemPrompt = fs.readFileSync(p, 'utf8');
                    }
                    catch { }
                }
                break;
            case '--ark-model':
                out.ark = { ...(out.ark || { apiKey: '', baseURL: '', modelId: '' }), modelId: argv[++i], apiKey: out.ark?.apiKey || '', baseURL: out.ark?.baseURL || '' };
                break;
            case '--ark-api-key':
                out.ark = { ...(out.ark || { modelId: 'gpt-4o-mini', baseURL: '', apiKey: '' }), apiKey: argv[++i] };
                break;
            case '--ark-base-url':
                out.ark = { ...(out.ark || { modelId: 'gpt-4o-mini', apiKey: '', baseURL: '' }), baseURL: argv[++i] };
                break;
            case '-v':
            case '--verbose':
                out.verbose = true;
                break;
            case '-h':
            case '--help':
                printHelp();
                process.exit(0);
            default:
                rest.push(a);
        }
    }
    out.prompt = rest.join(' ').trim();
    if (!out.prompt) {
        console.error('Error: missing prompt');
        printHelp();
        process.exit(2);
    }
    if (out.mode === 'remote' && !out.serverUrl) {
        console.error('Error: --server <url> is required in remote mode');
        process.exit(2);
    }
    if (out.mode === 'remote' && !out.sessionId) {
        console.error('Error: --session <id> is required in remote mode');
        process.exit(2);
    }
    return out;
}
function printHelp() {
    console.log(`
memsh chat — Stream AI SDK v6 UI messages

Usage:
  memsh chat [options] <prompt>

Local (in-process agent):
  memsh chat "explain the file layout"

Remote (use web server /api/chat):
  memsh chat --server http://localhost:3000 --session <id> "hello"

Options:
  --server <url>         Use remote server (switches to remote mode)
  --session <id>         Session id (required for remote mode)
  --rounds <n>           Max tool loop rounds (default 20)
  --system <path>        Read system prompt from file
  --ark-model <id>       ARK model id (local mode)
  --ark-api-key <key>    ARK API key (local mode)
  --ark-base-url <url>   ARK base URL (local mode)
  -v, --verbose          Verbose logging
  -h, --help             Show this help
`);
}
async function runLocal({ prompt, systemPrompt, maxRounds, ark, verbose }) {
    const memtools = new MemTools_1.MemTools();
    const agent = await (0, KianaAgentV6_1.createKianaAgent)(memtools, {
        systemPrompt: systemPrompt || KianaAgentV6_1.DEFAULT_SYSTEM_PROMPT,
        arkConfig: ark,
        maxRounds: maxRounds || 20,
        verbose: !!verbose,
    });
    const messages = [
        {
            id: `u-${Date.now()}`,
            role: 'user',
            parts: [{ type: 'text', text: prompt }],
        },
    ];
    const stream = await (0, ai_1.createAgentUIStream)({ agent, messages });
    for await (const m of stream) {
        // Handle different message types from the stream
        if (m.type === 'text-delta' && m.delta) {
            process.stdout.write(m.delta);
        }
        else if (m.type === 'tool-result' && m.result) {
            const name = m.toolName || 'unknown';
            const out = typeof m.result === 'string' ? m.result : JSON.stringify(m.result);
            process.stderr.write(`\n[tool ${name}] ${out}\n`);
        }
        else if (m.type === 'tool-error' && m.error) {
            const name = m.toolName || 'unknown';
            process.stderr.write(`\n[tool ${name} error] ${m.error}\n`);
        }
    }
    process.stdout.write('\n');
}
async function runRemote({ serverUrl, sessionId, prompt }) {
    const transport = new ai_1.DefaultChatTransport({
        api: `${serverUrl.replace(/\/$/, '')}/api/chat`,
    });
    const messages = [
        { id: `u-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: prompt }] },
    ];
    const chunkStream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: sessionId,
        messageId: undefined,
        messages,
        body: { sessionId },
        abortSignal: undefined,
    });
    const uiStream = (0, ai_1.readUIMessageStream)({ stream: chunkStream });
    for await (const m of uiStream) {
        for (const part of m.parts) {
            if ((0, ai_1.isTextUIPart)(part))
                process.stdout.write(part.text);
            if ((0, ai_1.isToolOrDynamicToolUIPart)(part)) {
                const name = (0, ai_1.getToolOrDynamicToolName)(part);
                if (part.state === 'output-available') {
                    const out = typeof part.output === 'string' ? part.output : JSON.stringify(part.output);
                    process.stderr.write(`\n[tool ${name}] ${out}\n`);
                }
                if (part.state === 'output-error') {
                    process.stderr.write(`\n[tool ${name} error] ${part.errorText || 'unknown error'}\n`);
                }
            }
        }
    }
    process.stdout.write('\n');
}
async function runMemshChat(argv) {
    const args = parseArgs(argv);
    if (args.mode === 'remote')
        return runRemote(args);
    return runLocal(args);
}
