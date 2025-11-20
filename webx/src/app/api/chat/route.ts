import { NextRequest } from "next/server";
import { getSessionStore } from "@/server/sessionStore";
import {
  createKianaAgent,
  DEFAULT_SYSTEM_PROMPT,
  createWeatherTools,
} from "@byted/kiana";
import { createAgentUIStreamResponse, type UIMessage } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getArkConfig() {
  const apiKey = process.env.ARK_API_KEY || process.env.ARK_TOKEN || "";
  const baseURL =
    process.env.ARK_BASE_URL || "https://ark-ap-southeast.byteintl.net/api/v3";
  const modelId = process.env.ARK_MODEL_ID || "ep-20250821060450-4bc6g";
  if (!apiKey) throw new Error("Missing ARK_API_KEY in environment");
  return { apiKey, baseURL, modelId };
}

export async function POST(req: NextRequest) {
  const store = getSessionStore();
  const body = await req.json();
  const { sessionId, id, messages, systemPrompt, maxRounds, message } = (body ||
    {}) as {
    sessionId?: string;
    id?: string;
    messages?: UIMessage[];
    message?: string;
    systemPrompt?: string;
    maxRounds?: number;
  };
  const effectiveSessionId = sessionId || id;
  if (!effectiveSessionId)
    return new Response("Missing sessionId", { status: 400 });
  const rec = store.get(effectiveSessionId);
  if (!rec) return new Response("Session not found", { status: 404 });

  // Accept both AI SDK UI messages and the older { message: string } form
  let inputMessages: UIMessage[] = Array.isArray(messages)
    ? (messages as any)
    : [];
  if (
    !Array.isArray(messages) &&
    typeof message === "string" &&
    message.trim().length > 0
  ) {
    inputMessages = [
      {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: message.trim() }],
      } as any,
    ];
  }

  const ark = getArkConfig();
  // Resolve system prompt from MemFS _system_prompt unless explicitly provided
  const fs = rec.shell.fs;
  let system = systemPrompt;
  try {
    const node: any = fs.resolvePath("/_system_prompt");
    if (!system && node && node.isFile()) {
      system = node.read();
    }
  } catch {}
  if (!system) system = DEFAULT_SYSTEM_PROMPT;

  // Create weather tools with OpenWeatherMap API key
  const weatherTools = createWeatherTools(process.env.OPENWEATHERMAP_API_KEY);

  const agent = await createKianaAgent(rec.shell, {
    // Instruction not required for Agent UI streaming mode.
    systemPrompt: system,
    arkConfig: ark,
    maxRounds: maxRounds ?? 20,
    stream: true,
    verbose: false,
    // Inject weather tools into the agent
    additionalTools: weatherTools,
  });

  return createAgentUIStreamResponse({
    agent,
    messages: inputMessages,
  });
}
