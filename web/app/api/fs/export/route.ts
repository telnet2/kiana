import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';
import { zipMemDir } from '@/server/zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return new Response('Missing sessionId', { status: 400 });
  const store = getSessionStore();
  const session = store.get(sessionId);
  if (!session) return new Response('Session not found', { status: 404 });

  const buf = await zipMemDir(session.memtools.getFileSystem().root);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="memfs-${sessionId}.zip"`
    }
  });
}

