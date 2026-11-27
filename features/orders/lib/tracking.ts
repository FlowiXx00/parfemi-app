/**
 * Post Express shipment tracking.
 *
 * Pošta Srbije's tracking page takes the number through a form (it has no documented link that opens
 * the result directly), so the site shows the number with a copy button and links to that page.
 * If a direct link format is ever known, set NEXT_PUBLIC_TRACKING_URL with {broj} in it, e.g.
 * "https://example.rs/pracenje?broj={broj}".
 */

export const DEFAULT_TRACKING_URL = "https://www.posta.rs/lat/alati/pracenje-posiljke.aspx";

/** " pe 1234 5678 rs " -> "PE12345678RS"; null if it doesn't look like a shipment number. */
export function normalizeTrackingNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.toUpperCase().replace(/[\s.]+/g, "");
  return /^[A-Z0-9-]{4,40}$/.test(cleaned) ? cleaned : null;
}

/** Tracking page for a shipment number (the number goes into the link only if the template has {broj}). */
export function trackingUrl(trackingNumber: string, template = process.env.NEXT_PUBLIC_TRACKING_URL) {
  const base = template?.trim() || DEFAULT_TRACKING_URL;
  return base.includes("{broj}") ? base.replace("{broj}", encodeURIComponent(trackingNumber)) : base;
}

/** Whether the tracking link already opens the result (otherwise the customer pastes the number). */
export function trackingLinkHasNumber(template = process.env.NEXT_PUBLIC_TRACKING_URL) {
  return Boolean(template?.includes("{broj}"));
}
