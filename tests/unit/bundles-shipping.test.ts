import { describe, expect, it } from "vitest";
import {
  bundleCartId,
  customBundleCartId,
  customBundleDiscount,
  parseBundleCartId,
  parseCustomBundleCartId,
  priceBundle,
} from "@/features/bundles/lib/bundles";
import { validateBundle } from "@/features/bundles/lib/validate-bundle";
import { describeShipping, freeShippingProgress, shippingFor } from "@/features/orders/lib/shipping";

const perfume = (id: string, price: number, inStock = true) => ({
  id,
  variants: [
    { ml: 5, priceRsd: price, inStock },
    { ml: 10, priceRsd: price * 2, inStock },
  ],
});

describe("priceBundle", () => {
  const perfumes = [perfume("a", 1500), perfume("b", 2500), perfume("c", 1999)];

  it("applies the discount and rounds down to 10 RSD", () => {
    const result = priceBundle(["a", "b", "c"], perfumes, 5, 15);
    expect(result.regular).toBe(5999);
    expect(result.price).toBe(5090); // 5999 * 0.85 = 5099.15 -> 5090
    expect(result.available).toBe(true);
  });

  it("per-perfume prices always add up to the bundle price (for order lines)", () => {
    const result = priceBundle(["a", "b", "c"], perfumes, 5, 15);
    expect(result.linePrices.reduce((sum, value) => sum + value, 0)).toBe(result.price);
  });

  it("bundle is unavailable if a perfume lacks that volume in stock", () => {
    const result = priceBundle(["a", "x"], [...perfumes, perfume("x", 1000, false)], 5, 10);
    expect(result.available).toBe(false);
    expect(result.missing).toEqual(["x"]);
  });

  it("a perfume that doesn't exist is reported as missing", () => {
    expect(priceBundle(["a", "nema"], perfumes, 5, 10).missing).toEqual(["nema"]);
  });
});

describe("bundle cart IDs", () => {
  it("ready-made bundle", () => {
    expect(parseBundleCartId(bundleCartId("top-5"))).toBe("top-5");
    expect(parseBundleCartId("creed-aventus")).toBeNull();
  });

  it("custom bundle: 3–5 distinct perfumes", () => {
    expect(parseCustomBundleCartId(customBundleCartId(["a", "b", "c"]))).toEqual(["a", "b", "c"]);
    expect(parseCustomBundleCartId("mojpaket:a+b")).toBeNull(); // premalo
    expect(parseCustomBundleCartId("mojpaket:a+b+c+d+e+f")).toBeNull(); // too many
    expect(parseCustomBundleCartId("mojpaket:a+a+b")).toBeNull(); // duplikat
  });

  it("discount grows with the number of perfumes", () => {
    expect([2, 3, 4, 5].map(customBundleDiscount)).toEqual([0, 10, 12, 15]);
  });
});

describe("validateBundle", () => {
  it("builds a slug from the title (including ć, š, đ)", () => {
    expect(validateBundle({ title: "Đurđevak & Šljiva", ml: 5, discount_pct: 10, perfume_ids: ["a", "b"] }).id).toBe(
      "djurdjevak-sljiva"
    );
  });

  it("rejects a single-perfume bundle or an excessive discount", () => {
    expect(() => validateBundle({ title: "Test", ml: 5, discount_pct: 10, perfume_ids: ["a"] })).toThrow();
    expect(() => validateBundle({ title: "Test", ml: 5, discount_pct: 80, perfume_ids: ["a", "b"] })).toThrow();
  });
});

describe("shipping", () => {
  const settings = { shippingRsd: 580, freeShippingFromRsd: 5000 };

  it("free above the threshold, and an empty cart has no shipping", () => {
    expect(shippingFor(2, 4999, settings)).toBe(580);
    expect(shippingFor(2, 5000, settings)).toBe(0);
    expect(shippingFor(0, 0, settings)).toBe(0);
  });

  it("free-shipping progress bar", () => {
    expect(freeShippingProgress(3000, settings)).toEqual({ threshold: 5000, missing: 2000, percent: 60, reached: false });
    expect(freeShippingProgress(6000, settings)?.reached).toBe(true);
    expect(freeShippingProgress(3000, { shippingRsd: 580, freeShippingFromRsd: null })).toBeNull();
  });

  it("customer-facing description", () => {
    expect(describeShipping({ shippingRsd: 0, freeShippingFromRsd: null })).toBe("besplatna");
  });
});
