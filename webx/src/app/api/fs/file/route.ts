import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const path = req.nextUrl.searchParams.get('path');

  if (!sessionId || !path) {
    return Response.json({ error: 'Missing sessionId or path' }, { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return Response.json({ error: 'Session not found' }, { status: 404 });

  try {
    const fs = rec.memtools.getFileSystem();
    const node: any = fs.resolvePath(path);
    if (!node || !node.isFile()) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }
    const content = node.read();
    return Response.json({ content });
  } catch (e) {
    return Response.json({ error: `Error reading file: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const body = await req.json();
  const { path, content } = body;

  if (!sessionId || !path) {
    return Response.json({ error: 'Missing sessionId or path' }, { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return Response.json({ error: 'Session not found' }, { status: 404 });

  try {
    const fs = rec.memtools.getFileSystem();
    const node: any = fs.resolvePath(path);

    if (node) {
      if (!node.isFile()) {
        return Response.json({ error: 'Path is not a file' }, { status: 400 });
      }
      node.write(content ?? '');
    } else {
      // Create the file if it doesn't exist
      fs.createFile(path, content ?? '');
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: `Error writing file: ${(e as Error).message}` }, { status: 500 });
  }
}
