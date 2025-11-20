import { getSessionStore } from '@/server/sessionStore';
import { getVFSClient } from '@/server/vfsClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getSessionStore();
  await store.initialize();
  const sessions = store.list().map((s) => ({ id: s.id, createdAt: s.createdAt }));
  return Response.json({ sessions });
}

export async function POST() {
  const store = getSessionStore();
  const session = await store.create();
  return Response.json({ session: { id: session.id, createdAt: session.createdAt } });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');

  if (!sessionId) {
    return Response.json({ error: 'Session ID is required' }, { status: 400 });
  }

  try {
    const store = getSessionStore();
    await store.deleteWithCleanup(sessionId);

    // Flush remaining dirty files to VFS
    const vfs = getVFSClient();
    try {
      await (vfs as any).flush?.();
    } catch (error) {
      console.warn('Failed to flush VFS after session deletion:', error);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete session ${sessionId}:`, error);
    return Response.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
