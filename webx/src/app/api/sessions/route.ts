import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getSessionStore();
  const sessions = store.list().map((s) => ({ id: s.id, createdAt: s.createdAt }));
  console.log(`GET /api/sessions - Store has ${sessions.length} sessions:`, sessions.map(s => s.id));
  return Response.json({ sessions });
}

export async function POST() {
  const store = getSessionStore();
  const session = store.create();
  console.log(`POST /api/sessions - Created session: ${session.id}`);
  console.log(`POST /api/sessions - Store now has ${store.list().length} sessions:`, store.list().map(s => s.id));
  return Response.json({ session: { id: session.id, createdAt: session.createdAt } });
}
