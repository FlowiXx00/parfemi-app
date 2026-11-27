import "server-only";
import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { getClientIp } from "@/lib/request-security";

/**
 * Rate limits shared by all server instances (counters in Supabase, migration 017).
 *
 * The in-memory limits in request-security.ts only count per server process; on Vercel there are many
 * processes and each cold start begins at zero. These counters hold everywhere, which matters for
 * anything that costs money (the AI chat) or can be brute-forced (coupon codes).
 * The visitor's IP is never stored: only a keyed hash, and counters older than two days are deleted
 * by the daily job.
 */

/** One hit on a counter: true = allowed, false = over the limit, null = the counter isn't available. */
export async function hitSharedLimit(key: string, limit: number, windowSeconds: number): Promise<boolean | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc("hit_rate_limit", {
      p_key: key.slice(0, 200),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      // Before migration 017 the function doesn't exist yet: the caller falls back to its own limit.
      if (error.code !== "PGRST202" && error.code !== "42883") console.error("RATE LIMIT ERROR:", error.message);
      return null;
    }
    return data === true;
  } catch (error) {
    console.error("RATE LIMIT ERROR:", error);
    return null;
  }
}

/** Visitor key without the IP itself (HMAC, so the hash can't be reversed by trying all IPs). */
export function visitorKey(request: NextRequest) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "atelier-dekant";
  return createHmac("sha256", secret).update(getClientIp(request)).digest("hex").slice(0, 32);
}

/** Per-visitor shared limit for a route: a 429 response when over the limit, otherwise null. */
export async function protectWithSharedLimit(
  request: NextRequest,
  options: { key: string; limit: number; windowSeconds: number }
) {
  const allowed = await hitSharedLimit(`${options.key}:${visitorKey(request)}`, options.limit, options.windowSeconds);
  if (allowed !== false) return null;
  return NextResponse.json(
    { error: "Previše zahteva. Pokušaj ponovo za koji minut." },
    { status: 429, headers: { "Retry-After": String(Math.min(options.windowSeconds, 600)) } }
  );
}

/** Deletes counters whose window ended more than two days ago (daily job). */
export async function cleanupSharedLimits() {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabaseAdmin
    .from("rate_limits")
    .delete({ count: "exact" })
    .lt("window_start", cutoff);
  if (error && error.code !== "42P01") console.error("RATE LIMIT CLEANUP ERROR:", error.message);
  return count ?? 0;
}
