import { getSessionStore } from '@/server/sessionStore';

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
