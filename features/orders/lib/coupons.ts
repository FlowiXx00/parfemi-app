/**
 * Coupons: type, validity checks and discount calculation.
 * Coupons are stored in the database (`coupons` table, Admin > Coupons); there are no codes in here.
 * The same code is used by the cart (display) and the server (final check when ordering).
 */

export type CouponType = "percent" | "fixed";

/** What the customer sees after applying a coupon. */
export type Coupon = {
  code: string;
  label: string;
  type: CouponType;
  value: number;
  minSubtotal?: number;
};

/** Database row (the admin sees everything). */
export type CouponRow = {
  code: string;
  label: string;
  type: CouponType;
  value: number;
  min_subtotal_rsd: number | null;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CouponStatus = "active" | "off" | "scheduled" | "expired" | "used_up";

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,30}$/;

export function normalizeCouponCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** Coupon status right now (for the admin badge and validation). */
export function couponStatus(row: CouponRow, now = new Date()): CouponStatus {
  if (!row.is_active) return "off";
  if (row.starts_at && new Date(row.starts_at) > now) return "scheduled";
  if (row.expires_at && new Date(row.expires_at) <= now) return "expired";
  if (row.max_uses !== null && row.used_count >= row.max_uses) return "used_up";
  return "active";
}

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  active: "Aktivan",
  off: "Ugašen",
  scheduled: "Počinje kasnije",
  expired: "Istekao",
  used_up: "Potrošen",
};

function toPublicCoupon(row: CouponRow): Coupon {
  return {
    code: row.code,
    label: row.label,
    type: row.type,
    value: row.value,
    ...(row.min_subtotal_rsd ? { minSubtotal: row.min_subtotal_rsd } : {}),
  };
}

/**
 * Whether the coupon applies to this cart. Messages are customer-facing (they deliberately don't reveal
 * whether a disabled code exists).
 */
export function checkCoupon(
  row: CouponRow | null,
  subtotal: number,
  now = new Date()
): { ok: true; coupon: Coupon } | { ok: false; error: string } {
  if (!row) return { ok: false, error: "Kupon nije pronađen." };

  const status = couponStatus(row, now);
  if (status === "off") return { ok: false, error: "Kupon nije pronađen." };
  if (status === "scheduled") return { ok: false, error: "Ovaj kupon još nije aktivan." };
  if (status === "expired") return { ok: false, error: "Kupon je istekao." };
  if (status === "used_up") return { ok: false, error: "Kupon je iskorišćen do kraja." };

  if (row.min_subtotal_rsd && subtotal < row.min_subtotal_rsd) {
    return {
      ok: false,
      error: `Za kupon ${row.code} potrebno je najmanje ${row.min_subtotal_rsd.toLocaleString("sr-RS")} rsd u korpi.`,
    };
  }

  return { ok: true, coupon: toPublicCoupon(row) };
}

export function getCouponDiscount(subtotal: number, coupon: Coupon | null) {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return 0;

  if (coupon.type === "percent") {
    return Math.round((subtotal * coupon.value) / 100);
  }

  return Math.min(coupon.value, subtotal);
}

export function describeCoupon(coupon: Pick<Coupon, "type" | "value">) {
  return coupon.type === "percent"
    ? `${coupon.value}% popusta`
    : `${coupon.value.toLocaleString("sr-RS")} rsd popusta`;
}
