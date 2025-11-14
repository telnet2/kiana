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
        // Try different ways to get entries
        let entries = null;

        // Try as property first
        if (node.entries && typeof node.entries !== 'function') {
          entries = node.entries;
          console.log(`Got entries as property at ${path}`);
        }
        // Try as method
        else if (typeof node.entries === 'function') {
          entries = node.entries();
          console.log(`Got entries as method at ${path}`);
        }

        // Also check for children property
        if (!entries && node.children) {
          entries = node.children;
          console.log(`Got entries as children property at ${path}`);
        }

        if (entries) {
          // Debug: log what type of entries we got
          console.log(`Entries type at ${path}:`, {
            isMap: entries instanceof Map,
            isArray: Array.isArray(entries),
            isIterable: typeof entries[Symbol.iterator] === 'function',
            keys: entries instanceof Map ? Array.from(entries.keys()) : (Array.isArray(entries) ? entries.map((e: any) => e.name) : Object.keys(entries)),
          });

          // Handle different iterable types
          if (entries instanceof Map || (typeof entries[Symbol.iterator] === 'function' && !Array.isArray(entries))) {
            for (const [name, child] of entries) {
              const childPath = `${path}/${name}`.replace(/\/+/g, '/');
              const childNode = buildTree(childPath, fs);
              if (childNode) {
                children.push(childNode);
              }
            }
          } else if (Array.isArray(entries)) {
            // Handle array of nodes
            for (const child of entries) {
              const name = child.name || child;
              const childPath = `${path}/${name}`.replace(/\/+/g, '/');
              const childNode = buildTree(childPath, fs);
              if (childNode) {
                children.push(childNode);
              }
            }
          } else if (typeof entries === 'object') {
            // Handle object-based entries
            for (const name in entries) {
              const childPath = `${path}/${name}`.replace(/\/+/g, '/');
              const childNode = buildTree(childPath, fs);
              if (childNode) {
                children.push(childNode);
              }
            }
          }
        } else {
          console.log(`No entries found at ${path}`);
        }
      } catch (entriesErr) {
        console.warn(`Error iterating entries at ${path}:`, (entriesErr as Error).message);
        console.log(`Node properties at ${path}:`, Object.keys(node));
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
