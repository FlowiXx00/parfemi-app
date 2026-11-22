/**
 * Tabela: wishlist_items
 */
import type { Db } from "@/db/types";

export type WishlistInsertMeta = {
  preferred_ml?: number | null;
  note?: string | null;
};

export async function listWishlistItems(db: Db, userId: string) {
  return await db
    .from("wishlist_items")
    .select("id, user_id, product_id, preferred_ml, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function findWishlistItem(
  db: Db,
  userId: string,
  productId: string
) {
  return await db
    .from("wishlist_items")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
}

export async function insertWishlistItem(
  db: Db,
  userId: string,
  productId: string,
  meta?: WishlistInsertMeta
) {
  return await db.from("wishlist_items").insert({
    user_id: userId,
    product_id: productId,
    preferred_ml: meta?.preferred_ml ?? null,
    note: meta?.note ?? null,
  });
}

export async function deleteWishlistItem(
  db: Db,
  userId: string,
  productId: string
) {
  return await db
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
}
