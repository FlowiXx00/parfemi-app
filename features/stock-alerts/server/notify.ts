import "server-only";
import { supabaseAdmin } from "@/db/clients/admin";
import { readStockMap, variantAvailable } from "@/db/queries/stock";
import {
  listPendingStockAlerts,
  markStockAlertsNotified,
  type PendingStockAlertRow,
} from "@/db/queries/stock-alerts";
import { emailConfigured } from "@/features/notifications/server/email";
import { sendBackInStockEmail } from "@/features/notifications/server/customer-emails";
import { stripBrandPrefix } from "@/features/shop/lib/product-name";
import { dueNotifications } from "@/features/stock-alerts/lib/alerts";

/** Emails per run (Resend allows a couple per second; the rest go out on the next run). */
const MAX_EMAILS_PER_RUN = 60;
const PAUSE_BETWEEN_EMAILS_MS = 550;

type PerfumeAvailability = { name: string; brand: string; volumes: number[] };

/** Available volumes per perfume right now (fresh from the database, not the cached catalog). */
async function readAvailability(perfumeIds: string[]) {
  const [{ data: perfumes }, { data: variants }, stock] = await Promise.all([
    supabaseAdmin.from("perfumes").select("id, name, brand, is_active").in("id", perfumeIds),
    supabaseAdmin.from("perfume_variants").select("perfume_id, ml, in_stock").in("perfume_id", perfumeIds),
    readStockMap(supabaseAdmin, perfumeIds),
  ]);

  const result = new Map<string, PerfumeAvailability>();
  for (const perfume of (perfumes ?? []) as { id: string; name: string; brand: string; is_active: boolean }[]) {
    const volumes = perfume.is_active
      ? ((variants ?? []) as { perfume_id: string; ml: number; in_stock: boolean }[])
          .filter((variant) => variant.perfume_id === perfume.id)
          .filter((variant) => variantAvailable(Boolean(variant.in_stock), Number(variant.ml), stock.get(perfume.id)))
          .map((variant) => Number(variant.ml))
          .sort((a, b) => a - b)
      : [];
    result.set(perfume.id, { name: stripBrandPrefix(perfume.brand, perfume.name), brand: perfume.brand, volumes });
  }
  return result;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends "back in stock" emails for the given perfumes to customers waiting for a volume that is now
 * available, and marks those alerts as sent. Call after anything that can make a perfume available
 * (admin save, stock top-up, cancelled order) and from the daily job. Never throws.
 */
export async function notifyBackInStock(perfumeIds: string[]) {
  const ids = [...new Set(perfumeIds.filter(Boolean))];
  if (!ids.length || !emailConfigured()) return { sent: 0 };

  try {
    const { data, error } = await listPendingStockAlerts(supabaseAdmin, ids);
    if (error) {
      // Before migration 017 there is no table yet: nothing to send.
      if (error.code !== "42P01") console.error("STOCK ALERTS READ ERROR:", error);
      return { sent: 0 };
    }

    const alerts = (data ?? []) as PendingStockAlertRow[];
    if (!alerts.length) return { sent: 0 };

    const availability = await readAvailability([...new Set(alerts.map((alert) => alert.perfume_id))]);
    const volumesByPerfume = new Map([...availability].map(([id, info]) => [id, info.volumes]));
    const due = dueNotifications(alerts, volumesByPerfume).slice(0, MAX_EMAILS_PER_RUN);

    let sent = 0;
    for (const [index, notification] of due.entries()) {
      const perfume = availability.get(notification.perfumeId);
      if (!perfume) continue;

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(notification.userId);
      const email = userData?.user?.email;
      if (!email) {
        // The account no longer exists or has no email: nobody to tell.
        await markStockAlertsNotified(supabaseAdmin, notification.alertIds);
        continue;
      }

      if (index > 0) await pause(PAUSE_BETWEEN_EMAILS_MS);
      const ok = await sendBackInStockEmail({
        to: email,
        perfume: { id: notification.perfumeId, name: perfume.name, brand: perfume.brand },
        volumes: notification.volumes,
      });

      // Only a sent email closes the alert; otherwise it's tried again next time.
      if (ok) {
        await markStockAlertsNotified(supabaseAdmin, notification.alertIds);
        sent++;
      }
    }

    return { sent };
  } catch (error) {
    console.error("BACK IN STOCK NOTIFY ERROR:", error);
    return { sent: 0 };
  }
}
