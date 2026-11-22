import { describe, expect, it } from "vitest";
import {
  checkCoupon,
  couponStatus,
  describeCoupon,
  getCouponDiscount,
  normalizeCouponCode,
  type CouponRow,
} from "@/features/orders/lib/coupons";
import { validateCouponPayload } from "@/features/admin/coupons/lib/coupon-form";

const NOW = new Date("2026-06-15T12:00:00Z");

const row = (overrides: Partial<CouponRow> = {}): CouponRow => ({
  code: "DEKANT10",
  label: "Test",
  type: "percent",
  value: 10,
  min_subtotal_rsd: null,
  starts_at: null,
  expires_at: null,
  max_uses: null,
  used_count: 0,
  is_active: true,
  ...overrides,
});

describe("couponStatus", () => {
  it("distinguishes every coupon state", () => {
    expect(couponStatus(row(), NOW)).toBe("active");
    expect(couponStatus(row({ is_active: false }), NOW)).toBe("off");
    expect(couponStatus(row({ starts_at: "2026-07-01T00:00:00Z" }), NOW)).toBe("scheduled");
    expect(couponStatus(row({ expires_at: "2026-06-01T00:00:00Z" }), NOW)).toBe("expired");
    expect(couponStatus(row({ max_uses: 5, used_count: 5 }), NOW)).toBe("used_up");
  });
});

describe("checkCoupon", () => {
  it("a disabled coupon looks like a missing one (doesn't reveal the code exists)", () => {
    expect(checkCoupon(row({ is_active: false }), 5000, NOW)).toEqual({ ok: false, error: "Kupon nije pronađen." });
    expect(checkCoupon(null, 5000, NOW)).toEqual({ ok: false, error: "Kupon nije pronađen." });
  });

  it("enforces the minimum cart amount", () => {
    const result = checkCoupon(row({ min_subtotal_rsd: 3000 }), 2999, NOW);
    expect(result.ok).toBe(false);
    expect(checkCoupon(row({ min_subtotal_rsd: 3000 }), 3000, NOW).ok).toBe(true);
  });
});

describe("getCouponDiscount", () => {
  it("computes the percentage and rounds", () => {
    expect(getCouponDiscount(3333, { code: "X", label: "", type: "percent", value: 10 })).toBe(333);
  });

  it("a fixed discount never exceeds the cart", () => {
    expect(getCouponDiscount(400, { code: "X", label: "", type: "fixed", value: 500 })).toBe(400);
    expect(getCouponDiscount(4000, { code: "X", label: "", type: "fixed", value: 500 })).toBe(500);
  });

  it("no discount below the minimum or without a coupon", () => {
    expect(getCouponDiscount(2000, { code: "X", label: "", type: "percent", value: 10, minSubtotal: 3000 })).toBe(0);
    expect(getCouponDiscount(2000, null)).toBe(0);
  });
});

describe("normalizeCouponCode / describeCoupon", () => {
  it("normalizes customer input", () => {
    expect(normalizeCouponCode("  dekant 10 ")).toBe("DEKANT10");
  });

  it("describes the discount", () => {
    expect(describeCoupon({ type: "percent", value: 15 })).toBe("15% popusta");
    expect(describeCoupon({ type: "fixed", value: 500 })).toBe("500 rsd popusta");
  });
});

describe("validateCouponPayload (admin + server)", () => {
  it("accepts a valid coupon", () => {
    expect(validateCouponPayload({ code: "leto15", type: "percent", value: 15 })).toMatchObject({
      code: "LETO15",
      type: "percent",
      value: 15,
      is_active: true,
    });
  });

  it("rejects invalid values", () => {
    expect(() => validateCouponPayload({ code: "X", type: "percent", value: 10 })).toThrow();
    expect(() => validateCouponPayload({ code: "LETO", type: "percent", value: 150 })).toThrow();
    expect(() => validateCouponPayload({ code: "LETO", type: "fixed", value: 0 })).toThrow();
    expect(() =>
      validateCouponPayload({
        code: "LETO",
        type: "percent",
        value: 10,
        starts_at: "2026-07-01T00:00:00Z",
        expires_at: "2026-06-01T00:00:00Z",
      })
    ).toThrow();
  });
});
