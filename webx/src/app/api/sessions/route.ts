import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getSessionStore();
  await store.initialize();
  const sessions = store.list().map((s) => ({ id: s.id, name: s.name, createdAt: s.createdAt }));
  return Response.json({ sessions });
}

export async function POST() {
  const store = getSessionStore();
  const session = await store.create();
  return Response.json({ session: { id: session.id, name: session.name, createdAt: session.createdAt } });
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
    return Response.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete session ${sessionId}:`, error);
    return Response.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('id');

  if (!sessionId) {
    return Response.json({ error: 'Session ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (typeof name !== 'string') {
      return Response.json({ error: 'Name must be a string' }, { status: 400 });
    }

    const store = getSessionStore();
    await store.updateSessionName(sessionId, name);

    return Response.json({ success: true });
  } catch (error) {
    console.error(`Failed to update session name ${sessionId}:`, error);
    return Response.json({ error: 'Failed to update session name' }, { status: 500 });
  }
}
