import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const path = req.nextUrl.searchParams.get('path');

  if (!sessionId || !path) {
    return new Response('Missing sessionId or path', { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return new Response('Session not found', { status: 404 });

  try {
    const fs = rec.memtools.getFileSystem();
    const node: any = fs.resolvePath(path);
    if (!node || !node.isFile()) {
      return new Response('File not found', { status: 404 });
    }
    const content = node.read();
    return Response.json({ content });
  } catch (e) {
    return new Response(`Error reading file: ${(e as Error).message}`, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const body = await req.json();
  const { path, content } = body;

  if (!sessionId || !path) {
    return new Response('Missing sessionId or path', { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return new Response('Session not found', { status: 404 });

  try {
    const fs = rec.memtools.getFileSystem();
    fs.writeFileSync(path, content ?? '');
    return Response.json({ success: true });
  } catch (e) {
    return new Response(`Error writing file: ${(e as Error).message}`, { status: 500 });
  }
}
