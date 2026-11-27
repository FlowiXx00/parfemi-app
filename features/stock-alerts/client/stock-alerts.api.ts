"use client";

import { createClient } from "@/db/clients/browser";
import {
  deleteStockAlert,
  insertStockAlert,
  listMyStockAlerts,
  type StockAlertRow,
} from "@/db/queries/stock-alerts";

/**
 * "Javi mi kad bude na stanju" from the browser: the signed-in customer's own alerts (RLS allows only
 * their own rows). The email is sent by the server once the perfume is available again.
 */
export type StockAlert = { id: string; perfumeId: string; ml: number | null; createdAt: string };

const toAlert = (row: StockAlertRow): StockAlert => ({
  id: row.id,
  perfumeId: row.perfume_id,
  ml: row.ml === null ? null : Number(row.ml),
  createdAt: row.created_at,
});

async function currentUserId() {
  const supabase = createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data } = await supabase.auth.getSession();
  return { supabase, userId: data.session?.user?.id ?? null };
}

function emitUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("stock-alerts:updated"));
}

/** Waiting alerts (optionally for one perfume). Empty when signed out or on error. */
export async function readMyStockAlerts(perfumeId?: string): Promise<StockAlert[]> {
  const { supabase, userId } = await currentUserId();
  if (!supabase || !userId) return [];
  const { data, error } = await listMyStockAlerts(supabase, userId, perfumeId);
  if (error) {
    console.error("Obaveštenja o dostupnosti nisu učitana:", error.message);
    return [];
  }
  return ((data ?? []) as StockAlertRow[]).map(toAlert);
}

/** New alert; one that already exists for the same perfume and volume counts as done. */
export async function createStockAlert(perfumeId: string, ml: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, userId } = await currentUserId();
  if (!supabase || !userId) return { ok: false, error: "Prijavi se da bismo mogli da ti javimo." };

  const { error } = await insertStockAlert(supabase, { user_id: userId, perfume_id: perfumeId, ml });
  if (error && error.code !== "23505") {
    console.error("Obaveštenje nije sačuvano:", error.message);
    return { ok: false, error: "Obaveštenje nije sačuvano. Pokušaj ponovo." };
  }

  emitUpdated();
  return { ok: true };
}

export async function cancelStockAlert(id: string) {
  const { supabase, userId } = await currentUserId();
  if (!supabase || !userId) return false;
  const { error } = await deleteStockAlert(supabase, userId, id);
  if (error) {
    console.error("Obaveštenje nije otkazano:", error.message);
    return false;
  }
  emitUpdated();
  return true;
}
