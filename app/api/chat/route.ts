import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  isChatEnabled,
  runShopAssistant,
  type ChatEvent,
  type ChatMessage,
} from "@/features/chat/server/shop-assistant";
import { protectMutationRoute } from "@/lib/request-security";

export const maxDuration = 60;

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 800;

/**
 * Site-wide daily limit (protects the API account from abuse): CHAT_DAILY_LIMIT, 1000 messages by
 * default.
 * Counted per server process.
 */
const daily = { day: "", count: 0 };
function underDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) {
    daily.day = today;
    daily.count = 0;
  }
  const limit = Number(process.env.CHAT_DAILY_LIMIT) || 1000;
  if (daily.count >= limit) return false;
  daily.count++;
  return true;
}

/** Whether the assistant is enabled (the chat button only shows if it is). */
export async function GET() {
  return NextResponse.json({ enabled: isChatEnabled() });
}

/** Conversation messages -> streamed reply (NDJSON: one JSON event per line). */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "shop-chat",
    limit: 20, // messages per visitor per 10 minutes
    windowMs: 10 * 60_000,
  });
  if (protection) return protection;

  if (!isChatEnabled()) {
    return NextResponse.json({ error: "Savetnik trenutno nije dostupan." }, { status: 503 });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  // Only user and assistant text; the first and the last message must come from the user.
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: typeof item.content === "string" ? item.content.trim().slice(0, MAX_MESSAGE_LENGTH) : "",
    }))
    .filter((message) => message.content)
    .slice(-MAX_MESSAGES);
  while (messages.length && messages[0]!.role !== "user") messages.shift();

  if (!messages.length || messages[messages.length - 1]!.role !== "user") {
    return NextResponse.json({ error: "Napiši pitanje." }, { status: 400 });
  }

  if (!underDailyLimit()) {
    return NextResponse.json(
      { error: "Savetnik je danas imao puno pitanja — probaj sutra ili nam piši preko stranice Kontakt." },
      { status: 429 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: ChatEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runShopAssistant(messages, emit);
        emit({ type: "done" });
      } catch (error) {
        console.error("[chat]", error);
        const message =
          error instanceof Anthropic.RateLimitError
            ? "Savetnik je trenutno zauzet. Probaj ponovo za minut."
            : error instanceof Anthropic.AuthenticationError
              ? "Savetnik nije podešen (neispravan ključ)."
              : "Savetnik trenutno ne može da odgovori. Probaj ponovo.";
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
