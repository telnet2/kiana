import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getSessionStore();
  return Response.json({ sessions: store.list() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = body?.name as string | undefined;
  const store = getSessionStore();
  const session = store.create(name);
  return Response.json({ session: { id: session.id, name: session.name, createdAt: session.createdAt } });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const store = getSessionStore();
  if (!id) return new Response('Missing id', { status: 400 });
  const ok = store.remove(id);
  if (!ok) return new Response('Not found', { status: 404 });
  return Response.json({ ok: true });
}
