import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) {
    return new Response('Session not found', { status: 404 });
  }

  try {
    console.log(`Flushing session ${sessionId}`);
    await rec.shell.flush();

    // Get updated stats after flush
    const stats = rec.shell.getVFSStats();

    return Response.json({
      success: true,
      dirtyFiles: stats.dirtyFiles,
      deletedFiles: stats.deletedFiles,
      cachedFiles: stats.cachedFiles,
      lastSyncTime: stats.lastSyncTime,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`Flush failed for session ${sessionId}:`, errorMessage);
    return Response.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
