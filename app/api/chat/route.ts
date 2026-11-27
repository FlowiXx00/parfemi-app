import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  isChatEnabled,
  runShopAssistant,
  type ChatEvent,
  type ChatMessage,
} from "@/features/chat/server/shop-assistant";
import { protectMutationRoute } from "@/lib/request-security";
import { hitSharedLimit, protectWithSharedLimit } from "@/lib/shared-rate-limit";

export const maxDuration = 60;

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 800;
const PER_VISITOR_LIMIT = 20; // messages per visitor per 10 minutes
const PER_VISITOR_WINDOW_SECONDS = 10 * 60;

/** Fallback when the shared counter isn't available (before migration 017): counted per server process. */
const daily = { day: "", count: 0 };
function underLocalDailyLimit(limit: number) {
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) {
    daily.day = today;
    daily.count = 0;
  }
  if (daily.count >= limit) return false;
  daily.count++;
  return true;
}

/**
 * Site-wide daily limit (protects the API account from abuse): CHAT_DAILY_LIMIT, 1000 messages by
 * default. Counted in Supabase, so it holds across all server instances and restarts.
 */
async function underDailyLimit() {
  const limit = Number(process.env.CHAT_DAILY_LIMIT) || 1000;
  const today = new Date().toISOString().slice(0, 10);
  const shared = await hitSharedLimit(`chat:day:${today}`, limit, 24 * 60 * 60);
  return shared ?? underLocalDailyLimit(limit);
}

/** Whether the assistant is enabled (the chat button only shows if it is). */
export async function GET() {
  return NextResponse.json({ enabled: isChatEnabled() });
}

/** Conversation messages -> streamed reply (NDJSON: one JSON event per line). */
export async function POST(req: NextRequest) {
  // Same origin + a quick per-process limit first, then the shared per-visitor limit.
  const protection = protectMutationRoute(req, {
    key: "shop-chat",
    limit: PER_VISITOR_LIMIT,
    windowMs: PER_VISITOR_WINDOW_SECONDS * 1000,
  });
  if (protection) return protection;

  const sharedProtection = await protectWithSharedLimit(req, {
    key: "chat:visitor",
    limit: PER_VISITOR_LIMIT,
    windowSeconds: PER_VISITOR_WINDOW_SECONDS,
  });
  if (sharedProtection) return sharedProtection;

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

  if (!(await underDailyLimit())) {
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
