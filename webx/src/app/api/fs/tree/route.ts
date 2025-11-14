import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Node = {
  type: 'file' | 'directory';
  name: string;
  children?: Node[];
};

function buildTree(path: string, fs: any): Node | null {
  try {
    const node = fs.resolvePath(path);
    if (!node) {
      // Root directory might not exist yet - that's okay, return empty root
      if (path === '/') {
        console.log('Root directory not found, returning empty root');
        return {
          type: 'directory',
          name: '/',
          children: [],
        };
      }
      return null;
    }

    if (node.isFile && node.isFile()) {
      return {
        type: 'file',
        name: path.split('/').pop() || path,
      };
    }

    if (node.isDirectory && node.isDirectory()) {
      const children: Node[] = [];
      try {
        // MemDirectory exposes children as a Map<string, MemNode> property
        // and optionally has a listChildren() method
        const childNodes = typeof node.listChildren === 'function'
          ? node.listChildren()
          : node.children instanceof Map
            ? Array.from(node.children.values())
            : [];

        console.log(`Found ${childNodes.length} children at ${path}`);

        for (const child of childNodes) {
          const childPath = `${path}/${child.name}`.replace(/\/+/g, '/');
          const childNode = buildTree(childPath, fs);
          if (childNode) {
            children.push(childNode);
          }
        }
      } catch (entriesErr) {
        console.warn(`Error listing children at ${path}:`, (entriesErr as Error).message);
      }
      return {
        type: 'directory',
        name: path.split('/').pop() || '/',
        children,
      };
    }
  } catch (e) {
    // Log error for debugging
    console.error(`Error building tree at ${path}:`, (e as Error).message);
    // Root directory might have issues - return empty root as fallback
    if (path === '/') {
      return {
        type: 'directory',
        name: '/',
        children: [],
      };
    }
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
  console.log('Building tree for session:', sessionId);
  const root = buildTree('/', fs);

  if (root) {
    console.log(`Tree built successfully with ${countFiles(root)} files`);
  } else {
    console.warn('Tree is null for session:', sessionId);
  }

  return Response.json({ root });
}

function countFiles(node: Node | null): number {
  if (!node) return 0;
  let count = node.type === 'file' ? 1 : 0;
  if (node.children) {
    for (const child of node.children) {
      count += countFiles(child);
    }
  }
  return count;
}
