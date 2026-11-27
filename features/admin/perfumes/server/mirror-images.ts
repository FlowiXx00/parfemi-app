/**
 * Copies of perfume images in our Supabase Storage (bucket "perfume-images").
 *
 * The admin can paste any image link (fimgs.net, a brand site…). When the perfume is saved,
 * the server downloads the image, stores it with us and writes OUR link to the database. That way
 * images survive even if the original site goes down or changes the image.
 *
 * The file name is a content hash (sha256), so the same image is never stored twice.
 */
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/db/clients/admin";
import { isStoredImage, PERFUME_IMAGES_BUCKET, perfumeStorageFolder } from "@/features/shop/lib/product-images";
import type { ProductImage } from "@/features/shop/types";
import { ImportError, safeFetch } from "./safe-fetch";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15_000;

const EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
};

/** Detects the format from the first bytes (in case the server sends the wrong Content-Type). */
function sniffImageType(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (ascii(4, 8) === "ftyp" && /avi[fs]/.test(ascii(8, 12))) return "image/avif";
  return null;
}

const safeFolder = perfumeStorageFolder;

/** Downloads one image from a link and stores it in the bucket; returns our public URL. */
async function storeImageFromUrl(perfumeId: string, sourceUrl: string): Promise<string> {
  const { bytes, contentType } = await safeFetch(sourceUrl, {
    accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    maxBytes: MAX_IMAGE_BYTES,
    timeoutMs: IMAGE_TIMEOUT_MS,
    truncateOverLimit: false,
  });
  return storeImageBytes(perfumeId, bytes, contentType);
}

/** Stores image bytes in the bucket (used for downloaded images and computer uploads). */
export async function storeImageBytes(
  perfumeId: string,
  bytes: Uint8Array,
  declaredType: string
): Promise<string> {
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImportError("Slika je prevelika (najviše 10 MB).", 400);
  }
  const type = sniffImageType(bytes) ?? (EXTENSIONS[declaredType] ? declaredType : null);
  if (!type || !bytes.byteLength) {
    throw new ImportError("Link ne vodi do slike (PNG, JPG, WEBP, AVIF ili GIF).");
  }

  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
  const path = `${safeFolder(perfumeId)}/${hash}.${EXTENSIONS[type]}`;

  const { error } = await supabaseAdmin.storage.from(PERFUME_IMAGES_BUCKET).upload(path, bytes, {
    contentType: type,
    cacheControl: "31536000", // content never changes (name = hash)
    upsert: true,
  });
  if (error) {
    throw new ImportError(`Čuvanje slike nije uspelo: ${error.message}`, 500);
  }

  return supabaseAdmin.storage.from(PERFUME_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type StoreImagesResult = {
  images: ProductImage[];
  /** Images that couldn't be stored (the original link is kept). */
  warnings: string[];
  stored: number;
};

/** Moves all external perfume images to our storage. If one fails, its original link is kept. */
export async function storeExternalImages(perfumeId: string, images: ProductImage[]): Promise<StoreImagesResult> {
  const warnings: string[] = [];
  let stored = 0;

  const result: ProductImage[] = [];
  for (const [index, image] of images.entries()) {
    if (isStoredImage(image.url)) {
      result.push(image);
      continue;
    }
    try {
      const url = await storeImageFromUrl(perfumeId, image.url);
      result.push({ ...image, url });
      stored++;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "nepoznata greška";
      warnings.push(
        `Slika ${index + 1} nije mogla da se preuzme (${reason}). Za sada se prikazuje sa originalnog linka — ` +
          `da ne bi nestala, sačuvaj je na računar i dodaj preko „⬆ Sa računara”.`
      );
      result.push(image);
    }
  }

  return { images: result, warnings, stored };
}

/** Deletes all stored images of a perfume (when the perfume is deleted). */
export async function deleteStoredImages(perfumeId: string) {
  const folder = safeFolder(perfumeId);
  const bucket = supabaseAdmin.storage.from(PERFUME_IMAGES_BUCKET);
  const { data } = await bucket.list(folder, { limit: 100 });
  if (!data?.length) return;
  await bucket.remove(data.map((file) => `${folder}/${file.name}`));
}
