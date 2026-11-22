/**
 * Events for Google Analytics 4 and Meta Pixel. If the visitor hasn't accepted cookies
 * (or the IDs aren't set), the scripts aren't loaded and calls are silently skipped.
 */

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
  }
}

export type TrackItem = { id: string; name: string; brand?: string | undefined; ml?: number; price: number; qty?: number };

const toGaItem = (item: TrackItem) => ({
  item_id: item.id,
  item_name: item.name,
  item_brand: item.brand,
  item_variant: item.ml ? `${item.ml} ml` : undefined,
  price: item.price,
  quantity: item.qty ?? 1,
});

function safe(fn: () => void) {
  try {
    if (typeof window !== "undefined") fn();
  } catch {
    /* analytics must never break the site */
  }
}

/** Perfume view (product page or the shop quick view). */
export function trackViewItem(item: TrackItem) {
  safe(() => {
    window.gtag?.("event", "view_item", { currency: "RSD", value: item.price, items: [toGaItem(item)] });
    window.fbq?.("track", "ViewContent", { content_ids: [item.id], content_name: item.name, content_type: "product", value: item.price, currency: "RSD" });
  });
}

export function trackAddToCart(item: TrackItem) {
  safe(() => {
    const value = item.price * (item.qty ?? 1);
    window.gtag?.("event", "add_to_cart", { currency: "RSD", value, items: [toGaItem(item)] });
    window.fbq?.("track", "AddToCart", { content_ids: [item.id], content_name: item.name, content_type: "product", value, currency: "RSD" });
  });
}

export function trackPurchase(orderNumber: string, total: number, items: TrackItem[]) {
  safe(() => {
    window.gtag?.("event", "purchase", { transaction_id: orderNumber, currency: "RSD", value: total, items: items.map(toGaItem) });
    window.fbq?.("track", "Purchase", { content_ids: items.map((item) => item.id), content_type: "product", value: total, currency: "RSD", num_items: items.length });
  });
}
