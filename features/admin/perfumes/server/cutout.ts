import "server-only";
/**
 * Bottle images processed ONCE on the server (see features/shop/lib/cutout.ts): the same background
 * removal, cropping and liquid-color estimate the browser used to do for every visitor, done with sharp
 * when a perfume is saved (or in a batch from Admin → Podešavanja for existing perfumes).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabaseAdmin } from "@/db/clients/admin";
import { renderCutout } from "@/features/admin/perfumes/lib/render-cutout";
import {
  CUTOUT_VERSION,
  CUTOUT_WIDTHS,
  cutoutPath,
  needsCutout,
  type StoredCutout,
} from "@/features/shop/lib/cutout";
import { normalizeImages, PERFUME_IMAGES_BUCKET } from "@/features/shop/lib/product-images";
import { MAX_IMAGE_BYTES } from "./mirror-images";
import { safeFetch } from "./safe-fetch";

async function loadSourceImage(url: string): Promise<Buffer> {
  // A local image from public/ (e.g. /perfumes/...).
  if (url.startsWith("/") && !url.startsWith("//")) {
    const relative = url.split("?")[0]!.replace(/^\/+/, "");
    if (relative.includes("..")) throw new Error("Neispravna putanja slike.");
    return await readFile(join(process.cwd(), "public", relative));
  }
  const { bytes } = await safeFetch(url, {
    accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    maxBytes: MAX_IMAGE_BYTES,
    timeoutMs: 15_000,
    truncateOverLimit: false,
  });
  return Buffer.from(bytes);
}

/**
 * A network hiccup (Storage or the image host) shouldn't mark a good image as failed: up to 3 attempts.
 * The first batch run lost 113 of 1,253 images this way, all of which process fine on a retry.
 */
async function withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }
  throw lastError;
}

/** Makes and uploads both widths; returns what goes into perfumes.cutout. Throws on failure. */
export async function generateCutout(perfumeId: string, sourceUrl: string): Promise<StoredCutout> {
  const input = await withRetry(() => loadSourceImage(sourceUrl));
  const key = createHash("sha256").update(`${CUTOUT_VERSION}|${sourceUrl}`).digest("hex").slice(0, 16);

  let color: string | null = null;
  // The larger image last: its color estimate (more pixels) wins.
  for (const width of CUTOUT_WIDTHS) {
    const result = await renderCutout(input, width);
    color = result.color ?? color;
    await withRetry(async () => {
      const { error } = await supabaseAdmin.storage
        .from(PERFUME_IMAGES_BUCKET)
        .upload(cutoutPath(perfumeId, key, width), result.webp, {
          contentType: "image/webp",
          cacheControl: "31536000", // the name changes with the content
          upsert: true,
        });
      if (error) throw new Error(`Čuvanje obrađene slike nije uspelo: ${error.message}`);
    });
  }

  return { v: CUTOUT_VERSION, source: sourceUrl, key, color };
}

async function saveCutout(perfumeId: string, cutout: StoredCutout) {
  const { error } = await supabaseAdmin.from("perfumes").update({ cutout }).eq("id", perfumeId);
  if (error) throw new Error(error.message);
}

/**
 * Processes the main image of one perfume (if needed) and stores the result. A failed attempt is
 * remembered, so the batch doesn't retry the same broken image forever; the browser then processes it
 * as before. Returns "made" | "failed" | "skipped".
 */
export async function processPerfumeCutout(perfumeId: string, primaryUrl: string | undefined, current?: unknown) {
  if (!primaryUrl || !needsCutout(current, primaryUrl)) return "skipped" as const;
  try {
    await saveCutout(perfumeId, await generateCutout(perfumeId, primaryUrl));
    return "made" as const;
  } catch (error) {
    console.error(`CUTOUT ERROR (${perfumeId}):`, error instanceof Error ? error.message : error);
    await saveCutout(perfumeId, { v: CUTOUT_VERSION, source: primaryUrl, failed: true }).catch(() => undefined);
    return "failed" as const;
  }
}

/** After an admin save: (re)make the cutout of this perfume if its main image changed. */
export async function refreshPerfumeCutout(perfumeId: string) {
  const { data, error } = await supabaseAdmin.from("perfumes").select("images, cutout").eq("id", perfumeId).maybeSingle();
  // Before migration 017 there is no cutout column: nothing to do.
  if (error || !data) return "skipped" as const;
  const row = data as { images: unknown; cutout: unknown };
  return processPerfumeCutout(perfumeId, normalizeImages(row.images)[0]?.url, row.cutout);
}

export type CutoutOverview = {
  total: number;
  done: number;
  failed: number;
  pending: { id: string; primaryUrl: string; cutout: unknown }[];
  /** Failed attempts for the current image, sorted by ID (JS order, for the retry cursor). */
  failedItems: { id: string; primaryUrl: string }[];
};

/** All perfumes with an image: how many have a cutout, how many failed and which still need one. */
export async function readCutoutOverview(): Promise<CutoutOverview | null> {
  const rows: { id: string; images: unknown; cutout: unknown }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("perfumes")
      .select("id, images, cutout")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) return null; // e.g. migration 017 not run yet
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }

  const overview: CutoutOverview = { total: 0, done: 0, failed: 0, pending: [], failedItems: [] };
  for (const row of rows) {
    const primaryUrl = normalizeImages(row.images)[0]?.url;
    if (!primaryUrl) continue;
    overview.total++;
    if (needsCutout(row.cutout, primaryUrl)) {
      overview.pending.push({ id: row.id, primaryUrl, cutout: row.cutout });
    } else if ((row.cutout as { failed?: boolean } | null)?.failed) {
      overview.failed++;
      overview.failedItems.push({ id: row.id, primaryUrl });
    } else {
      overview.done++;
    }
  }
  // Postgres sorts IDs by its collation; the retry cursor compares in JS, so sort the same way here.
  overview.failedItems.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return overview;
}
