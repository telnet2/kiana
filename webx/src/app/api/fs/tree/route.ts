import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';

type Node = {
  type: 'file' | 'directory';
  name: string;
  children?: Node[];
};

function buildTree(path: string, fs: any): Node | null {
  try {
    const node = fs.resolvePath(path);
    if (!node) return null;

    if (node.isFile()) {
      return {
        type: 'file',
        name: path.split('/').pop() || path,
      };
    }

    if (node.isDirectory()) {
      const children: Node[] = [];
      const entries = node.entries();
      if (entries) {
        for (const [name, child] of entries) {
          const childPath = `${path}/${name}`.replace(/\/+/g, '/');
          const childNode = buildTree(childPath, fs);
          if (childNode) {
            children.push(childNode);
          }
        }
      }
      return {
        type: 'directory',
        name: path.split('/').pop() || '/',
        children,
      };
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return new Response('Missing sessionId', { status: 400 });

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return new Response('Session not found', { status: 404 });

  const fs = rec.memtools.getFileSystem();
  const root = buildTree('/', fs);

  return Response.json({ root });
}
