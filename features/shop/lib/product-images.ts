import type { ProductImage } from "@/features/shop/types";

/** Grey "No image" tile when an image is missing or fails to load. */
export const PRODUCT_IMAGE_FALLBACK = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="100%" height="100%" fill="#ecebe8"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#8a8580" font-family="Arial, sans-serif" font-size="40">No image</text></svg>`
)}`;

export const MAX_PRODUCT_IMAGES = 12;

export function getPrimaryImage(product: { images: ProductImage[] }) {
  return product.images[0]?.url || PRODUCT_IMAGE_FALLBACK;
}

/** Supabase Storage bucket where copies of perfume images are kept. */
export const PERFUME_IMAGES_BUCKET = "perfume-images";

/** Folder of one perfume's files in the bucket (its ID, limited to safe characters). */
export function perfumeStorageFolder(perfumeId: string) {
  return perfumeId.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "ostalo";
}

/**
 * The image is already ours (our Storage or /public) -> doesn't depend on another site.
 * Works in the browser and on the server (NEXT_PUBLIC_ variables are available everywhere).
 */
export function isStoredImage(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/${PERFUME_IMAGES_BUCKET}/`);
}

/**
 * next/image optimizes only our own images (next.config.ts remotePatterns); an image still on another
 * site (couldn't be copied on save) is shown as is, with `unoptimized`.
 */
export function canOptimizeImage(url: string) {
  return isStoredImage(url);
}

/** Allowed image URL: https://… or a local path starting with "/". */
export function isAllowedImageUrl(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return true;

  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Turns anything from the database/request into a clean image list. */
export function normalizeImages(value: unknown): ProductImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};

      return {
        url: typeof row.url === "string" ? row.url.trim() : "",
        label: typeof row.label === "string" ? row.label.trim().slice(0, 60) : "",
      };
    })
    .filter((image) => image.url && isAllowedImageUrl(image.url))
    .slice(0, MAX_PRODUCT_IMAGES);
}
