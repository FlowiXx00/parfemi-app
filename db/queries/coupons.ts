/**
 * Table: coupons (service_role only; customers have no access, see migration 013).
 */
import type { Db } from "@/db/types";
import type { CouponRow } from "@/features/orders/lib/coupons";

const COUPON_SELECT =
  "code, label, type, value, min_subtotal_rsd, starts_at, expires_at, max_uses, used_count, is_active, created_at, updated_at";

export async function listCoupons(db: Db) {
  return await db.from("coupons").select(COUPON_SELECT).order("created_at", { ascending: false });
}

export async function getCouponByCode(db: Db, code: string) {
  return await db.from("coupons").select(COUPON_SELECT).eq("code", code).maybeSingle<CouponRow>();
}

export type CouponWriteRow = Omit<CouponRow, "used_count" | "created_at" | "updated_at">;

export async function insertCoupon(db: Db, row: CouponWriteRow) {
  return await db.from("coupons").insert({ ...row, updated_at: new Date().toISOString() });
}

/** Update an existing coupon (the use count isn't touched). */
export async function updateCoupon(db: Db, code: string, row: Partial<CouponWriteRow>) {
  return await db
    .from("coupons")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("code", code)
    .select("code")
    .maybeSingle();
}

export async function deleteCoupon(db: Db, code: string) {
  return await db.from("coupons").delete().eq("code", code).select("code").maybeSingle();
}

/** Atomically "redeem" a coupon; returns the row on success (coupon still valid and not used up). */
export async function redeemCoupon(db: Db, code: string) {
  const { data, error } = await db.rpc("redeem_coupon", { p_code: code });
  const rows = (data ?? []) as CouponRow[];
  return { row: rows[0] ?? null, error };
}

/** Gives a use back (the order wasn't written). */
export async function releaseCoupon(db: Db, code: string) {
  return await db.rpc("release_coupon", { p_code: code });
}
