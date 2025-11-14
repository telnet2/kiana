# Next.js + MemFS Integration FAQ

Learning from building **webx** - a modern file manager + terminal using Next.js 15, React 19, and kiana's MemFS/MemShell.

## Architecture Questions

### Q: Can MemShell run in the browser?
**A:** No. MemShell requires Node.js and runs only on the server. The browser communicates with MemShell through API endpoints. Design your architecture with API routes as the bridge:
- **Browser**: UI components, fetch calls to `/api/*`
- **Server**: API routes, MemShell execution, session management

### Q: How do I keep sessions persistent across API routes?
**A:** Use `globalThis` instead of module-level variables for singleton stores:

```typescript
// ❌ Wrong - each route gets different instance in dev mode
let store: SessionStore | null = null;

// ✅ Correct - persists across module reloads
declare global {
  var sessionStore: SessionStore | undefined;
}

export function getSessionStore(): SessionStore {
  if (!global.sessionStore) {
    global.sessionStore = new SessionStore();
  }
  return global.sessionStore;
}
```

**Why?** In Next.js dev mode, routes are compiled separately and reloaded on file changes. Module-level variables reset, but `globalThis` persists across reloads.

### Q: Do I need the 'use server' directive in my backend files?
**A:** No, not for API routes. The `'use server'` directive is for Server Components and Server Actions (React features), not for Route Handlers. It also requires all exports to be async functions. Just put your code in `src/server/` and import it from API routes.

## Webpack & Bundling Issues

### Q: I get "Module not found: Can't resolve 'coffee-script'" - what's happening?
**A:** webpack is trying to bundle Node.js-only modules for the browser. Configure Next.js to exclude them:

```javascript
// next.config.js
webpack: (config, { isServer }) => {
  // Don't bundle Node.js modules for browser
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      vm2: false,
      'coffee-script': false,
      fs: false,
      path: false,
      child_process: false,
    };
  }

  // Mark as external - don't bundle on server either
  config.externals = [
    ...config.externals,
    'vm2',
    'coffee-script',
    '@byted/kiana',
  ];

  return config;
},
```

**Why?** vm2 and coffee-script use Node.js APIs like `require.extensions` that don't exist in browsers.

### Q: I still get webpack warnings about "Critical dependency"
**A:** These are safe to ignore if you've configured webpack correctly. They appear because vm2 and coffee-script use dynamic requires. The webpack config prevents them from being bundled to the browser.

## API Route Configuration

### Q: My POST endpoint returns 404 even though the route file exists
**A:** Add these exports to your API route:

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // ...
}
```

- `runtime = 'nodejs'`: Use Node.js runtime (needed for native modules)
- `dynamic = 'force-dynamic'`: Re-execute on every request (not cached)

Without these, Next.js may cache the route or use incorrect runtime.

### Q: How do I read query parameters in a POST request?
**A:** Use the URL object directly (works in Next.js 15+):

```typescript
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  // ...
}
```

Both `req.nextUrl.searchParams` and `new URL(req.url).searchParams` work, but the latter is more reliable.

## Kiana Integration

### Q: Do I use `createMemTools()` or `new MemTools()`?
**A:** Use `new MemTools()` - it's a class, not a factory function:

```typescript
// ❌ Wrong
import { createMemTools } from '@byted/kiana';
const memtools = createMemTools();

// ✅ Correct
import { MemTools } from '@byted/kiana';
const memtools = new MemTools();
```

### Q: How do I get the shell from MemTools?
**A:** Call `getShell()` on the MemTools instance:

```typescript
const memtools = new MemTools();
const shell = memtools.getShell();
const result = await shell.exec('ls -la');
console.log(result.stdout);
```

### Q: What does createKianaAgent need?
**A:** Pass in the memtools instance and configuration:

```typescript
import { createKianaAgent, DEFAULT_SYSTEM_PROMPT } from '@byted/kiana';

const agent = await createKianaAgent(memtools, {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  arkConfig: { apiKey, baseURL, modelId },
  maxRounds: 20,
  stream: true,
  verbose: false,
});
```

## Version & Compatibility

### Q: Is Next.js 14.2.10 outdated?
**A:** Yes, upgrade to Next.js 15+ for better performance and modern features:

```json
{
  "next": "^15.1.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
}
```

### Q: I get "Unrecognized key(s) in object: 'swcMinify'"
**A:** Remove `swcMinify` from `next.config.js` - it's deprecated in Next.js 15. SWC minification is now always enabled by default.

```javascript
// ❌ Remove this
const nextConfig = {
  swcMinify: true,  // Delete this line
};
```

## Development Server Issues

### Q: I made a change but the server isn't picking it up
**A:** Restart the dev server. In Next.js dev mode, some changes (like new API routes) require a full restart, not just a hot reload:

```bash
# Stop with Ctrl+C, then restart
bun run dev
```

### Q: Sessions disappear after I change a file
**A:** This is because module-level state resets on hot reload. Use `globalThis` for persistent singletons (see architecture question above).

## TypeScript Configuration

### Q: What Next.js 15+ tsconfig settings do I need?
**A:** Use these settings for proper TypeScript support:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "preserve",
    "moduleResolution": "bundler",
    "allowJs": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ]
}
```

Key points:
- `jsx: "preserve"` - Let Next.js handle JSX compilation
- `esModuleInterop: true` - Required by Next.js for proper module handling
- `allowJs: true` - Allows mixing JavaScript and TypeScript

## File Structure Best Practices

### Q: Where should I put my Node.js-only code?
**A:** Use `/src/server/` directory for server-only modules:

```
src/
├── app/
│   ├── api/           # API route handlers
│   ├── page.tsx       # Pages (browser)
│   └── layout.tsx
├── components/        # React components (browser)
├── server/            # Node.js-only utilities
│   ├── sessionStore.ts
│   └── zip.ts
└── hooks/             # React hooks (browser)
```

Webpack automatically excludes `/src/server/` from browser bundles.

### Q: Should I use environment variables for API endpoints?
**A:** Yes, but separate them carefully:

```typescript
// .env.local
ARK_API_KEY=xxx          # Server-only secrets
ARK_BASE_URL=xxx
ARK_MODEL_ID=xxx

// Use in server code only
const apiKey = process.env.ARK_API_KEY;
```

Never expose secrets in client components. If you need to use an env var in the browser, prefix it with `NEXT_PUBLIC_`:

```typescript
// Only safe because it's not sensitive
NEXT_PUBLIC_API_URL=https://api.example.com
```

## AI SDK Integration

### Q: How do I stream LLM responses with AI SDK v6?
**A:** Use `createAgentUIStreamResponse`:

```typescript
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: NextRequest) {
  const agent = await createKianaAgent(memtools, config);

  return createAgentUIStreamResponse({
    agent,
    messages: inputMessages,
  });
}
```

Frontend receives streamed messages:
```typescript
const { messages, sendMessage, status } = useChat({
  api: '/api/chat',
  body: { sessionId },
});
```

## Common Pitfalls

### 1. **Session Store Lost Between Requests**
   - **Problem:** Sessions exist in one route but not another
   - **Solution:** Use `globalThis` for singleton pattern

### 2. **Webpack Tries to Bundle Node.js Modules**
   - **Problem:** "Can't resolve 'coffee-script'" or "require.extensions not supported"
   - **Solution:** Configure webpack externals and fallbacks in `next.config.js`

### 3. **Missing `export const dynamic = 'force-dynamic'`**
   - **Problem:** POST endpoints return 404 or cached responses
   - **Solution:** Add it to all dynamic API routes

### 4. **'use server' on Non-Async Functions**
   - **Problem:** "Server actions must be async functions"
   - **Solution:** Don't use `'use server'` on API routes, only on Server Components/Actions

### 5. **Hot Reload Loses State**
   - **Problem:** Sessions disappear after file changes
   - **Solution:** Store state on `globalThis`, not module-level variables

## Performance Tips

### Q: Should I enable SWC minification?
**A:** It's enabled by default in Next.js 15+, no configuration needed.

### Q: How do I optimize API routes?
**A:** Use these patterns:

```typescript
// ✅ Good: Minimal, single responsibility
export async function POST(req: NextRequest) {
  const data = await req.json();
  // Quick operation
  return Response.json({ result });
}

// ❌ Avoid: Large, slow operations
export async function POST(req: NextRequest) {
  // If this takes >30s, requests may timeout
  const result = await expensiveOperation();
}
```

### Q: Should I cache API responses?
**A:** Use `cache: 'no-store'` for dynamic data:

```typescript
const res = await fetch('/api/sessions', { cache: 'no-store' });
```

For static data that rarely changes, use default caching.

## Deployment Considerations

### Q: Will sessions persist in production?
**A:** No, not with `globalThis`. For production:
- Use a database (PostgreSQL, MongoDB) for session persistence
- Or Redis for in-memory session store
- Or implement proper session serialization

Currently `globalThis` is for development/demo only.

### Q: Do I need special configuration for Vercel?
**A:** Yes, ensure your Node.js modules are in `dependencies` not `devDependencies`:
- vm2
- coffee-script
- @byted/kiana

Vercel installs these during build.

---

## Summary Checklist

When integrating Next.js with MemFS/MemShell:

- [ ] Use `new MemTools()` not `createMemTools()`
- [ ] Store singletons on `globalThis` in dev
- [ ] Configure webpack to exclude Node.js modules from browser
- [ ] Add `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` to API routes
- [ ] Put server code in `/src/server/` directory
- [ ] Don't use `'use server'` on API route handlers
- [ ] Use `cache: 'no-store'` for dynamic API responses
- [ ] Restart dev server for new routes
- [ ] Check Next.js version is 15+ for latest features
- [ ] Never expose secrets in browser code

---

**Built with:** webx (Next.js 15, React 19, TypeScript, kiana MemFS/MemShell)
**Last Updated:** 2025-11-13
