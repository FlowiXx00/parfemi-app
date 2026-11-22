/**
 * Discovery bundles: several perfumes of the same volume at a discount.
 * The price is always computed from CURRENT perfume prices (same function on the page and at checkout).
 */

export type BundleRow = {
  id: string;
  title: string;
  description: string;
  ml: number;
  discount_pct: number;
  perfume_ids: string[];
  is_active: boolean;
  sort_order: number;
};

/** A bundle line in the cart has the ID "paket:<bundle id>". */
const BUNDLE_CART_PREFIX = "paket:";
export const bundleCartId = (bundleId: string) => `${BUNDLE_CART_PREFIX}${bundleId}`;
export const parseBundleCartId = (cartId: string) =>
  cartId.startsWith(BUNDLE_CART_PREFIX) ? cartId.slice(BUNDLE_CART_PREFIX.length) : null;

/* ------------------------- Build-your-own bundle (customer picks) ------------------------- */

/** Customer bundle in the cart: "mojpaket:<id1>+<id2>+…" (perfume IDs never contain "+"). */
export const CUSTOM_BUNDLE_PREFIX = "mojpaket:";
export const CUSTOM_BUNDLE_MIN = 3;
export const CUSTOM_BUNDLE_MAX = 5;
export const CUSTOM_BUNDLE_ML = [5, 10] as const;

/** Discount by perfume count: 3 → 10%, 4 → 12%, 5 → 15%. */
export function customBundleDiscount(count: number) {
  if (count >= 5) return 15;
  if (count === 4) return 12;
  if (count === 3) return 10;
  return 0;
}

export const customBundleCartId = (perfumeIds: string[]) => `${CUSTOM_BUNDLE_PREFIX}${perfumeIds.join("+")}`;

/** "mojpaket:a+b+c" -> ["a","b","c"] (or null if it isn't a valid customer bundle). */
export function parseCustomBundleCartId(cartId: string): string[] | null {
  if (!cartId.startsWith(CUSTOM_BUNDLE_PREFIX)) return null;
  const ids = cartId.slice(CUSTOM_BUNDLE_PREFIX.length).split("+").filter(Boolean);
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length || ids.length < CUSTOM_BUNDLE_MIN || ids.length > CUSTOM_BUNDLE_MAX) return null;
  return ids;
}

type PricedPerfume = {
  id: string;
  variants: { ml: number; priceRsd: number; inStock: boolean }[];
};

export type BundlePrice = {
  /** Sum of the individual prices for the selected volume. */
  regular: number;
  /** Bundle price (discounted, rounded down to 10 RSD). */
  price: number;
  /** Price per perfume in the bundle (sums to price), used for order lines. */
  linePrices: number[];
  /** All perfumes exist and have that volume in stock. */
  available: boolean;
  /** IDs of perfumes that are missing or don't have that volume. */
  missing: string[];
};

export function priceBundle(perfumeIds: string[], perfumes: PricedPerfume[], ml: number, discountPct: number): BundlePrice {
  const byId = new Map(perfumes.map((perfume) => [perfume.id, perfume]));
  const prices: number[] = [];
  const missing: string[] = [];

  for (const id of perfumeIds) {
    const variant = byId.get(id)?.variants.find((v) => v.ml === ml);
    if (!variant || !variant.inStock || !(variant.priceRsd > 0)) {
      missing.push(id);
      prices.push(variant?.priceRsd ?? 0);
    } else {
      prices.push(variant.priceRsd);
    }
  }

  const regular = prices.reduce((sum, value) => sum + value, 0);
  const price = Math.max(0, Math.floor((regular * (1 - discountPct / 100)) / 10) * 10);

  // Bundle price split across perfumes (proportionally), remainder on the last one.
  const linePrices = prices.map((value) => (regular > 0 ? Math.floor((value / regular) * price) : 0));
  const allocated = linePrices.reduce((sum, value) => sum + value, 0);
  if (linePrices.length) linePrices[linePrices.length - 1]! += price - allocated;

  return { regular, price, linePrices, available: missing.length === 0 && price > 0, missing };
}
