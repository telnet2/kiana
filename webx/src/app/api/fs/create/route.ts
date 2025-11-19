import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const body = await req.json();
  const { path, type = 'file' } = body;

  if (!sessionId || !path) {
    return Response.json({ error: 'Missing sessionId or path' }, { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return Response.json({ error: 'Session not found' }, { status: 404 });

  try {
    const fs = rec.memtools.getFileSystem();
    if (type === 'directory') {
      fs.createDirectories(path);
    } else {
      fs.createFile(path, '');
    }
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: `Error creating ${type}: ${(e as Error).message}` }, { status: 500 });
  }
}
