import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/db/clients/admin";
import {
  listOrdersForReviewRequest,
  markReviewRequestSent,
  type ReviewRequestOrderRow,
} from "@/db/queries/orders";
import { listPerfumesWithPendingAlerts } from "@/db/queries/stock-alerts";
import { emailConfigured } from "@/features/notifications/server/email";
import { sendReviewRequestEmail } from "@/features/notifications/server/customer-emails";
import { notifyBackInStock } from "@/features/stock-alerts/server/notify";
import { cleanupSharedLimits } from "@/lib/shared-rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Review request: delivered at least this many days ago (time to try the perfume)… */
const REVIEW_AFTER_DAYS = 3;
/** …and not more than this (no emails about old orders). */
const REVIEW_MAX_AGE_DAYS = 30;
const REVIEW_EMAILS_PER_RUN = 40;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Only Vercel Cron (Authorization: Bearer CRON_SECRET) may run this. */
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

async function sendReviewRequests() {
  if (!emailConfigured()) return { sent: 0, skipped: "email nije podešen" };

  const { data, error } = await listOrdersForReviewRequest(
    supabaseAdmin,
    REVIEW_AFTER_DAYS,
    REVIEW_MAX_AGE_DAYS,
    REVIEW_EMAILS_PER_RUN
  );
  if (error) {
    // Before migration 017 the column doesn't exist yet.
    if (error.code !== "42703") console.error("REVIEW REQUEST LIST ERROR:", error);
    return { sent: 0 };
  }

  let sent = 0;
  for (const [index, order] of ((data ?? []) as ReviewRequestOrderRow[]).entries()) {
    // One line per perfume (an order can have the same perfume in two volumes or in a bundle).
    const perfumes = new Map<string, { id: string; name: string; brand: string | null }>();
    for (const item of order.order_items ?? []) {
      if (!perfumes.has(item.perfume_id)) {
        perfumes.set(item.perfume_id, {
          id: item.perfume_id,
          name: item.perfume_name.replace(/\s*\(paket „.*”\)$/, ""),
          brand: item.perfume_brand,
        });
      }
    }

    if (index > 0) await pause(550);
    const ok = await sendReviewRequestEmail({
      orderNumber: order.order_number,
      customerName: order.customer_full_name,
      customerEmail: order.customer_email,
      hasAccount: Boolean(order.user_id),
      perfumes: [...perfumes.values()],
    });

    // Marked even without perfumes, so an odd order isn't retried every day.
    if (ok || perfumes.size === 0) {
      await markReviewRequestSent(supabaseAdmin, order.id);
      if (ok) sent++;
    }
  }

  return { sent };
}

/**
 * Daily job (vercel.json → crons):
 * 1) "How do you like it?" email a few days after delivery
 * 2) "Back in stock" emails that are due (e.g. stock changed directly in Supabase)
 * 3) deletes old rate-limit counters
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Nije dozvoljeno." }, { status: 401 });
  }

  const reviewRequests = await sendReviewRequests().catch((error) => {
    console.error("REVIEW REQUESTS ERROR:", error);
    return { sent: 0 };
  });

  const { ids } = await listPerfumesWithPendingAlerts(supabaseAdmin);
  const backInStock = await notifyBackInStock(ids);

  const removedCounters = await cleanupSharedLimits().catch(() => 0);

  return NextResponse.json({ ok: true, reviewRequests, backInStock, removedCounters });
}
