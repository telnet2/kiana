import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ensureDirs(memfs: any, fullPath: string) {
  const parts = fullPath.split('/').filter(Boolean);
  if (parts.length <= 1) return;
  const dirPath = parts.slice(0, -1).join('/');
  memfs.createDirectories(dirPath.startsWith('/') ? dirPath : `/${dirPath}`);
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return new Response('Missing sessionId', { status: 400 });
  const store = getSessionStore();
  const session = store.get(sessionId);
  if (!session) return new Response('Session not found', { status: 404 });

  const form = await req.formData();
  let count = 0;
  for (const [key, value] of form.entries()) {
    if (key !== 'file') continue;
    if (!(value instanceof File)) continue;
    const relPath = (value as any).webkitRelativePath || value.name;
    const buf = Buffer.from(await value.arrayBuffer());
    const memfs = session.memtools.getFileSystem();
    const target = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    ensureDirs(memfs, target);
    const full = target.startsWith('/') ? target : `/${target}`;
    try {
      memfs.createFile(full, buf.toString('utf8'));
    } catch {
      const node = memfs.resolvePath(full);
      if (node && node.isFile()) node.write(buf.toString('utf8'));
      else throw new Error(`Unable to write ${full}`);
    }
    count++;
  }

  return Response.json({ imported: count });
}
