/**
 * Table: perfume_stock (service_role only): how many ml are left in the bottle.
 * No row = stock isn't tracked (the manual per-volume "in stock" flag applies).
 */
import type { Db } from "@/db/types";

export type StockMap = Map<string, number>;

/** Stock of all tracked perfumes (or only for the given IDs). */
export async function readStockMap(db: Db, ids?: string[]): Promise<StockMap> {
  const map: StockMap = new Map();
  if (ids && ids.length === 0) return map;
  let query = db.from("perfume_stock").select("perfume_id, stock_ml");
  if (ids) query = query.in("perfume_id", ids);
  const { data, error } = await query;
  if (error) {
    console.error("Zalihe nisu učitane:", error.message);
    return map;
  }
  for (const row of (data ?? []) as { perfume_id: string; stock_ml: number }[]) {
    map.set(row.perfume_id, Number(row.stock_ml));
  }
  return map;
}

/** A volume is available if it's manually "in stock" and (when stock is tracked) there are enough ml in the bottle. */
export function variantAvailable(manualInStock: boolean, ml: number, stockMl: number | undefined) {
  return manualInStock && (stockMl === undefined || stockMl >= ml);
}

export async function setStock(db: Db, perfumeId: string, stockMl: number) {
  return await db
    .from("perfume_stock")
    .upsert({ perfume_id: perfumeId, stock_ml: stockMl, updated_at: new Date().toISOString() }, { onConflict: "perfume_id" });
}

/** Stop tracking stock for a perfume (falls back to the manual "in stock" flag). */
export async function stopTrackingStock(db: Db, perfumeId: string) {
  return await db.from("perfume_stock").delete().eq("perfume_id", perfumeId);
}

/** +delta ml (new bottle), atomic; returns the new value. */
export async function addStock(db: Db, perfumeId: string, delta: number) {
  const { data, error } = await db.rpc("add_perfume_stock", { p_perfume_id: perfumeId, p_delta: delta });
  return { stockMl: typeof data === "number" ? data : null, error };
}

export type StockLine = { perfume_id: string; ml: number };

/** Deducts ml for an order (all or nothing). Returns the ID of a perfume that's short, if any. */
export async function consumeStock(db: Db, lines: StockLine[]) {
  const { error } = await db.rpc("consume_perfume_stock", { p_items: lines });
  if (!error) return { ok: true as const };
  const short = error.message.match(/NEDOVOLJNO:(\S+)/)?.[1] ?? null;
  return { ok: false as const, shortPerfumeId: short, error };
}

export async function releaseStock(db: Db, lines: StockLine[]) {
  return await db.rpc("release_perfume_stock", { p_items: lines });
}

/** Cancelled order: return the ml (the function itself makes sure it doesn't happen twice). */
export async function restoreOrderStock(db: Db, orderId: number) {
  return await db.rpc("restore_order_stock", { p_order_id: orderId });
}
