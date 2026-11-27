/**
 * Bottle images processed once on the server ("cutouts"): white background removed, cropped, liquid
 * color estimated. Stored next to the perfume's images in Supabase Storage:
 *   perfume-images/<perfume id>/cutout-384-<key>.webp (shop cards, bundles)
 *   perfume-images/<perfume id>/cutout-828-<key>.webp (quick view)
 * The perfume row keeps { v, source, key, color } in the `cutout` column (migration 017). A cutout counts
 * only while it was made from the current main image with the current version; otherwise the browser
 * processes the image itself, as before.
 */
import { normalizeHexColor } from "@/features/shop/types";
import { PERFUME_IMAGES_BUCKET, perfumeStorageFolder } from "./product-images";

/** Raise when the processing changes, so all cutouts are made again. */
export const CUTOUT_VERSION = 1;
export const CUTOUT_WIDTHS = [384, 828] as const;
export type CutoutWidth = (typeof CUTOUT_WIDTHS)[number];

/** What the shop needs: file key + estimated liquid color. */
export type BottleCutout = { key: string; color: string | null };

/** What the database keeps (a failed attempt is remembered too, so it isn't retried endlessly). */
export type StoredCutout =
  | { v: number; source: string; key: string; color: string | null; failed?: false }
  | { v: number; source: string; failed: true };

export function cutoutPath(perfumeId: string, key: string, width: CutoutWidth) {
  return `${perfumeStorageFolder(perfumeId)}/cutout-${width}-${key}.webp`;
}

/** Public URL of a cutout (Supabase Storage CDN, cached for a year: the name changes with the content). */
export function cutoutUrl(perfumeId: string, key: string, width: CutoutWidth) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PERFUME_IMAGES_BUCKET}/${cutoutPath(perfumeId, key, width)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The stored cutout, if it belongs to this main image and version and didn't fail; otherwise null. */
export function readCutout(value: unknown, primaryImageUrl: string | undefined): BottleCutout | null {
  const row = asRecord(value);
  if (!row || !primaryImageUrl || row.v !== CUTOUT_VERSION || row.source !== primaryImageUrl || row.failed === true) {
    return null;
  }
  if (typeof row.key !== "string" || !/^[a-f0-9]{8,40}$/.test(row.key)) return null;
  return { key: row.key, color: normalizeHexColor(row.color) };
}

/**
 * Whether the server still has to (re)make the cutout: there is a main image and the stored one is
 * missing, outdated or made from another image. A failed attempt for the same image counts as done.
 */
export function needsCutout(value: unknown, primaryImageUrl: string | undefined) {
  if (!primaryImageUrl || primaryImageUrl.startsWith("data:")) return false;
  const row = asRecord(value);
  if (!row || row.v !== CUTOUT_VERSION || row.source !== primaryImageUrl) return true;
  return row.failed !== true && readCutout(value, primaryImageUrl) === null;
}

/** Ready-made image for a product at this width (null = the browser processes the image). */
export function cutoutFor(product: { id: string; cutout?: BottleCutout | null }, width: CutoutWidth) {
  return product.cutout ? { src: cutoutUrl(product.id, product.cutout.key, width), color: product.cutout.color } : null;
}
