import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  let body;
  let command;
  try {
    body = await req.json();
    command = body.command;
  } catch (e) {
    return new Response('Invalid request body', { status: 400 });
  }

  if (!command) {
    return new Response('Missing command', { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) {
    return new Response('Session not found', { status: 404 });
  }

  try {
    // Execute command using VFSMemShell2
    console.log(`Executing command: ${command}`);
    const output = rec.shell.exec(command);
    console.log(`Command output: ${output || '(empty)'}`);

    // Save command to history
    const trimmedOutput = output.trim();
    await store.updateHistory(sessionId, command, trimmedOutput);

    // Get dirty file count
    const stats = rec.shell.getVFSStats();

    return Response.json({
      command,
      output: trimmedOutput,
      exitCode: 0,
      dirtyFiles: stats.dirtyFiles,
    });
  } catch (e) {
    const errorMessage = (e as Error).message;
    console.error(`Command failed: ${command}`, errorMessage);
    return Response.json(
      {
        command,
        output: '',
        error: errorMessage,
        exitCode: 1,
        dirtyFiles: 0,
      },
      { status: 200 }
    );
  }
}
