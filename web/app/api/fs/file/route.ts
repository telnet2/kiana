import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const path = searchParams.get('path') || '';
  if (!sessionId) return new Response('Missing sessionId', { status: 400 });
  if (!path) return new Response('Missing path', { status: 400 });

  const store = getSessionStore();
  const session = store.get(sessionId);
  if (!session) return new Response('Session not found', { status: 404 });

  const fs = session.memtools.getFileSystem();
  const node = fs.resolvePath(path);
  if (!node) return new Response('Not found', { status: 404 });
  if (!node.isFile()) return new Response('Not a file', { status: 400 });
  return Response.json({ content: node.read() });
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return new Response('Missing sessionId', { status: 400 });

  const body = await req.json().catch(() => ({}));
  const path = body?.path as string;
  const content = body?.content as string;
  if (!path) return new Response('Missing path', { status: 400 });

  const store = getSessionStore();
  const session = store.get(sessionId);
  if (!session) return new Response('Session not found', { status: 404 });

  const fs = session.memtools.getFileSystem();
  const node = fs.resolvePath(path);
  if (node && !node.isFile()) return new Response('Not a file', { status: 400 });
  if (node && node.isFile()) {
    node.write(content ?? '');
  } else {
    // ensure directories exist
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash > 0) {
      const dir = normalized.slice(0, lastSlash);
      try { fs.createDirectories(dir); } catch {}
    }
    fs.createFile(normalized, content ?? '');
  }
  return Response.json({ ok: true });
}

