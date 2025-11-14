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
    const shell = rec.memtools.shell;
    const result = await shell.exec(command);

    // Format output
    let output = '';
    if (result.stdout) output += result.stdout;
    if (result.stderr) output += result.stderr;

    return Response.json({
      command,
      output: output.trim(),
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    });
  } catch (e) {
    return Response.json(
      {
        command,
        output: '',
        error: (e as Error).message,
        exitCode: 1,
      },
      { status: 500 }
    );
  }
}
