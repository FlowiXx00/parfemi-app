/**
 * Table: bundles (discovery bundles). Read by the server only (service role, migration 018):
 * customers see the active ones, the admin sees all.
 */
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/db/clients/admin";
import type { Db } from "@/db/types";
import type { BundleRow } from "@/features/bundles/lib/bundles";

const BUNDLE_SELECT = "id, title, description, ml, discount_pct, perfume_ids, is_active, sort_order";

/** Active bundles (cached together with the catalog, same "catalog" tag). */
export const getActiveBundles = unstable_cache(
  async (): Promise<BundleRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("bundles")
      .select(BUNDLE_SELECT)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Paketi nisu učitani:", error.message);
      return [];
    }
    return (data ?? []) as BundleRow[];
  },
  ["catalog:bundles"],
  { tags: ["catalog"], revalidate: 300 }
);

export async function listBundlesAdmin(db: Db) {
  return await db
    .from("bundles")
    .select(BUNDLE_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export async function getBundle(db: Db, id: string) {
  return await db.from("bundles").select(BUNDLE_SELECT).eq("id", id).maybeSingle<BundleRow>();
}

export async function upsertBundle(db: Db, row: BundleRow) {
  return await db.from("bundles").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "id" });
}

export async function deleteBundle(db: Db, id: string) {
  return await db.from("bundles").delete().eq("id", id).select("id").maybeSingle();
}
