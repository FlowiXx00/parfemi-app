/**
 * Shipping: all rules in one place. The values (price, free-shipping threshold) are
 * edited in Admin > Settings (shop_settings table); these are only defaults
 * for when the database doesn't respond.
 */

export type ShopSettings = {
  /** Price of one shipment (Post Express). */
  shippingRsd: number;
  /** Shipping is free from this amount (goods after discount); null = disabled. */
  freeShippingFromRsd: number | null;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = { shippingRsd: 580, freeShippingFromRsd: 5000 };

/** Shipping cost for a cart: 0 if the cart is empty or the total is above the threshold. */
export function shippingFor(itemsCount: number, goodsTotalRsd: number, settings: ShopSettings) {
  if (itemsCount <= 0) return 0;
  if (settings.freeShippingFromRsd && goodsTotalRsd >= settings.freeShippingFromRsd) return 0;
  return settings.shippingRsd;
}

/** How much is missing to free shipping and progress 0–100; null if free shipping is disabled. */
export function freeShippingProgress(goodsTotalRsd: number, settings: ShopSettings) {
  const threshold = settings.freeShippingFromRsd;
  if (!threshold) return null;
  const missing = Math.max(0, threshold - goodsTotalRsd);
  const percent = Math.min(100, Math.round((goodsTotalRsd / threshold) * 100));
  return { threshold, missing, percent, reached: missing === 0 };
}

/** Sentence for customers / the assistant, e.g. "580 rsd, besplatno od 5.000 rsd". */
export function describeShipping(settings: ShopSettings) {
  const price = settings.shippingRsd > 0 ? `${settings.shippingRsd.toLocaleString("sr-RS")} rsd` : "besplatna";
  return settings.freeShippingFromRsd && settings.shippingRsd > 0
    ? `${price}, a besplatna za porudžbine od ${settings.freeShippingFromRsd.toLocaleString("sr-RS")} rsd`
    : price;
}
