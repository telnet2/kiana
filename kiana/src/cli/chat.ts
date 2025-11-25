import { createAgentUIStream, DefaultChatTransport, readUIMessageStream, isTextUIPart, isToolOrDynamicToolUIPart, getToolOrDynamicToolName, type UIMessage } from 'ai';
import { createKianaAgent, DEFAULT_SYSTEM_PROMPT, type ARKConfig } from '../KianaAgentV6';
import { MemTools } from '../MemTools';
import { getARKConfigFromEnv } from '../envLoader';
import * as fs from 'node:fs';

type ChatArgs = {
  mode: 'local' | 'remote';
  serverUrl?: string;
  sessionId?: string;
  prompt: string;
  systemPrompt?: string;
  maxRounds?: number;
  ark?: ARKConfig;
  verbose?: boolean;
};

function parseArgs(argv: string[]): ChatArgs {
  const out: Partial<ChatArgs> = { mode: 'local', maxRounds: 20, verbose: false };
  // Defaults from env
  const ark = getARKConfigFromEnv();
  if (ark.apiKey) out.ark = ark;

  const rest: string[] = [];
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
          try { out.systemPrompt = fs.readFileSync(p, 'utf8'); } catch {}
        }
        break;
      case '--ark-model':
        out.ark = { ...(out.ark || { apiKey: '', baseURL: '' as any, modelId: '' }), modelId: argv[++i], apiKey: out.ark?.apiKey || '', baseURL: out.ark?.baseURL || '' } as ARKConfig;
        break;
      case '--ark-api-key':
        out.ark = { ...(out.ark || { modelId: 'gpt-4o-mini', baseURL: '' as any, apiKey: '' }), apiKey: argv[++i] } as ARKConfig;
        break;
      case '--ark-base-url':
        out.ark = { ...(out.ark || { modelId: 'gpt-4o-mini', apiKey: '' as any, baseURL: '' }), baseURL: argv[++i] } as ARKConfig;
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
  return out as ChatArgs;
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

async function runLocal({ prompt, systemPrompt, maxRounds, ark, verbose }: ChatArgs) {
  const memtools = new MemTools();
  const agent = await createKianaAgent(memtools, {
    systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
    arkConfig: ark,
    maxRounds: maxRounds || 20,
    verbose: !!verbose,
  });

  const messages: UIMessage[] = [
    {
      id: `u-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: prompt }],
    } as any,
  ];

  const stream: any = await createAgentUIStream({ agent, messages });
  for await (const m of stream as any) {
    // Handle different message types from the stream
    if (m.type === 'text-delta' && m.delta) {
      process.stdout.write(m.delta);
    } else if (m.type === 'tool-result' && m.result) {
      const name = m.toolName || 'unknown';
      const out = typeof m.result === 'string' ? m.result : JSON.stringify(m.result);
      process.stderr.write(`\n[tool ${name}] ${out}\n`);
    } else if (m.type === 'tool-error' && m.error) {
      const name = m.toolName || 'unknown';
      process.stderr.write(`\n[tool ${name} error] ${m.error}\n`);
    }
  }
  process.stdout.write('\n');
}

async function runRemote({ serverUrl, sessionId, prompt }: ChatArgs) {
  const transport = new DefaultChatTransport<UIMessage>({
    api: `${serverUrl!.replace(/\/$/, '')}/api/chat`,
  });

  const messages: UIMessage[] = [
    { id: `u-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: prompt }] } as any,
  ];

  const chunkStream = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: sessionId!,
    messageId: undefined,
    messages,
    body: { sessionId },
    abortSignal: undefined,
  });
  const uiStream: any = readUIMessageStream<UIMessage>({ stream: chunkStream });

  for await (const m of uiStream as any) {
    for (const part of (m as any).parts) {
      if (isTextUIPart(part)) process.stdout.write(part.text);
      if (isToolOrDynamicToolUIPart(part)) {
        const name = getToolOrDynamicToolName(part);
        if (part.state === 'output-available') {
          const out = typeof (part as any).output === 'string' ? (part as any).output : JSON.stringify((part as any).output);
          process.stderr.write(`\n[tool ${name}] ${out}\n`);
        }
        if (part.state === 'output-error') {
          process.stderr.write(`\n[tool ${name} error] ${(part as any).errorText || 'unknown error'}\n`);
        }
      }
    }
  }
  process.stdout.write('\n');
}

export async function runMemshChat(argv: string[]) {
  const args = parseArgs(argv);
  if (args.mode === 'remote') return runRemote(args);
  return runLocal(args);
}
