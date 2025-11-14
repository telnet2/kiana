import { NextRequest } from 'next/server';
import { getSessionStore } from '@/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const body = await req.json();
  const { command } = body;

  if (!sessionId || !command) {
    return new Response('Missing sessionId or command', { status: 400 });
  }

  const store = getSessionStore();
  const rec = store.get(sessionId);
  if (!rec) return new Response('Session not found', { status: 404 });

  try {
    const shell = rec.memtools.getShell();
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
