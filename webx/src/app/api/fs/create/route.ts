import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const body = await req.json();
  const { path, type = 'file' } = body;

  if (!sessionId || !path) {
    return new Response('Missing sessionId or path', { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return new Response('Session not found', { status: 404 });

  try {
    const fs = rec.memtools.getFileSystem();
    if (type === 'directory') {
      fs.createDirectories(path);
    } else {
      fs.writeFileSync(path, '');
    }
    return Response.json({ success: true });
  } catch (e) {
    return new Response(`Error creating ${type}: ${(e as Error).message}`, { status: 500 });
  }
}
