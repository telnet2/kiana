import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';

export async function GET() {
  const store = getSessionStore();
  const sessions = store.list().map((s) => ({ id: s.id, createdAt: s.createdAt }));
  return Response.json({ sessions });
}

export async function POST() {
  const store = getSessionStore();
  const session = store.create();
  return Response.json({ session: { id: session.id, createdAt: session.createdAt } });
}
