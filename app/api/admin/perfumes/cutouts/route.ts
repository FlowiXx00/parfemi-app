export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { revalidateCatalog } from "@/db/queries/perfumes";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { processPerfumeCutout, readCutoutOverview } from "@/features/admin/perfumes/server/cutout";
import { protectMutationRoute } from "@/lib/request-security";

const DEFAULT_BATCH = 6;
const MAX_BATCH = 10;
const CONCURRENCY = 3;

/** How far the processing is: { total, done, failed, remaining } (the demo account may look). */
export async function GET() {
  const auth = await requireAdminFromCookies({ allowDemo: true });
  if (auth.ok === false) return auth.response;

  const overview = await readCutoutOverview();
  if (!overview) {
    return NextResponse.json({ available: false, total: 0, done: 0, failed: 0, remaining: 0 });
  }
  const { total, done, failed, pending } = overview;
  return NextResponse.json({ available: true, total, done, failed, remaining: pending.length });
}

/**
 * Processes the next few perfumes ({ limit }) and returns the new state. The admin page calls this
 * again until nothing is left; the shop is refreshed once everything is done.
 *
 * { retryFailed: true, after } tries the failed ones again, each once per run: they go in ID order and
 * `next` is the cursor for the following call, so an image that fails again isn't picked forever.
 */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-cutouts", limit: 120, windowMs: 60_000 });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  const body = (await req.json().catch(() => null)) as { limit?: unknown; retryFailed?: unknown; after?: unknown } | null;
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(body?.limit) || DEFAULT_BATCH));
  const retryFailed = body?.retryFailed === true;
  const after = typeof body?.after === "string" ? body.after : "";

  const overview = await readCutoutOverview();
  if (!overview) {
    return NextResponse.json({ error: "Pokreni migraciju 017 u Supabase-u, pa probaj ponovo." }, { status: 409 });
  }

  // cutout: null = ignore the remembered failure and process the image again.
  const queue = retryFailed
    ? overview.failedItems.filter((item) => item.id > after).map((item) => ({ ...item, cutout: null }))
    : overview.pending;
  const batch = queue.slice(0, limit);
  let made = 0;
  let failed = 0;

  // A few at a time: downloading and uploading wait on the network more than on the CPU.
  for (let start = 0; start < batch.length; start += CONCURRENCY) {
    const results = await Promise.all(
      batch.slice(start, start + CONCURRENCY).map((item) => processPerfumeCutout(item.id, item.primaryUrl, item.cutout))
    );
    made += results.filter((result) => result === "made").length;
    failed += results.filter((result) => result === "failed").length;
  }

  const queueLeft = Math.max(0, queue.length - batch.length);
  // Shop cards switch to the new images once the run is finished.
  if (queueLeft === 0 && (made > 0 || failed > 0)) revalidateCatalog();

  return NextResponse.json({
    made,
    failed,
    total: overview.total,
    done: overview.done + made,
    // On a retry the ones that failed again were already counted.
    failedTotal: retryFailed ? overview.failed - made : overview.failed + failed,
    remaining: retryFailed ? overview.pending.length : queueLeft,
    retryRemaining: retryFailed ? queueLeft : overview.failedItems.length,
    next: batch.at(-1)?.id ?? null,
  });
}
