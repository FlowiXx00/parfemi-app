/**
 * Table: stock_alerts ("Javi mi kad bude na stanju", migration 017)
 *
 * The customer creates and deletes their own alerts (browser client, RLS: only their own rows).
 * Only the server marks an alert as sent (notified_at), right after the email goes out.
 */
import type { Db } from "@/db/types";

export type StockAlertRow = {
  id: string;
  perfume_id: string;
  ml: number | null;
  created_at: string;
};

export type PendingStockAlertRow = {
  id: string;
  user_id: string;
  perfume_id: string;
  ml: number | null;
};

/* ------------------------------- Customer ---------------------------------- */

/** The customer's alerts that are still waiting (optionally for one perfume). */
export async function listMyStockAlerts(db: Db, userId: string, perfumeId?: string) {
  let query = db
    .from("stock_alerts")
    .select("id, perfume_id, ml, created_at")
    .eq("user_id", userId)
    .is("notified_at", null)
    .order("created_at", { ascending: false });
  if (perfumeId) query = query.eq("perfume_id", perfumeId);
  return await query;
}

export async function insertStockAlert(db: Db, row: { user_id: string; perfume_id: string; ml: number | null }) {
  return await db.from("stock_alerts").insert(row).select("id, perfume_id, ml, created_at").single<StockAlertRow>();
}

export async function deleteStockAlert(db: Db, userId: string, id: string) {
  return await db.from("stock_alerts").delete().eq("id", id).eq("user_id", userId);
}

/* -------------------------------- Server ----------------------------------- */

/** Waiting alerts for these perfumes (service role). */
export async function listPendingStockAlerts(db: Db, perfumeIds: string[]) {
  return await db
    .from("stock_alerts")
    .select("id, user_id, perfume_id, ml")
    .in("perfume_id", perfumeIds)
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(1000);
}

/** Perfumes that have at least one waiting alert (daily job). */
export async function listPerfumesWithPendingAlerts(db: Db) {
  const { data, error } = await db.from("stock_alerts").select("perfume_id").is("notified_at", null).limit(5000);
  return { ids: [...new Set(((data ?? []) as { perfume_id: string }[]).map((row) => row.perfume_id))], error };
}

export async function markStockAlertsNotified(db: Db, ids: string[]) {
  return await db.from("stock_alerts").update({ notified_at: new Date().toISOString() }).in("id", ids);
}
