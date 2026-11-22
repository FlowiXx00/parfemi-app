/**
 * Bottle image processing in the browser:
 * 1) removes the white background (flood fill from the edges) -> the bottle looks good on a dark stage
 * 2) estimates the liquid color (for filling the pipette in the quick view)
 *
 * The heavy part (pixel by pixel) runs in a Web Worker so the main thread and scrolling stay smooth;
 * older browsers without OffscreenCanvas do the same on the main thread.
 * Images are read through the Next optimizer (/_next/image, same origin), so pixels can be read
 * even for images from other sites. Results are cached (by URL and size) while the page is open.
 */

import { PRODUCT_IMAGE_FALLBACK } from "@/features/shop/lib/product-images";
import { processBottlePixels } from "@/features/shop/lib/bottle-pixels";
import type { BottleJob, BottleResult } from "@/features/shop/lib/bottle-image.worker";

export type ProcessedBottle = {
  /** URL of the image without background (blob:), or the original URL if processing failed. */
  src: string;
  /** Estimated liquid color, e.g. "#c98a3a". */
  color: string;
  processed: boolean;
};

/** Color when it can't be estimated (clear/black/silver bottles): soft champagne. */
export const FALLBACK_LIQUID_COLOR = "#e2c48c";

/** Widths the Next optimizer allows (imageSizes/deviceSizes). */
export type BottleImageWidth = 384 | 828;

const cache = new Map<string, Promise<ProcessedBottle>>();

// Without a worker, jobs run one at a time so many cards appearing at once don't freeze the page.
let queue: Promise<unknown> = Promise.resolve();

function optimizedUrl(src: string, width: BottleImageWidth) {
  // q=75: Next 16 only allows this quality by default (images.qualities).
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/* ------------------------------ Web Worker ------------------------------ */

let worker: Worker | null | undefined;
let nextJobId = 1;
const pendingJobs = new Map<number, (result: BottleResult) => void>();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
      return (worker = null);
    }
    worker = new Worker(new URL("./bottle-image.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<BottleResult>) => {
      pendingJobs.get(event.data.id)?.(event.data);
      pendingJobs.delete(event.data.id);
    };
    worker.onerror = () => {
      // The worker couldn't start -> everything from now on runs on the main thread.
      worker = null;
      for (const resolve of pendingJobs.values()) resolve({ id: 0, ok: false, reason: "process" });
      pendingJobs.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

function processInWorker(target: Worker, url: string) {
  return new Promise<BottleResult>((resolve) => {
    const id = nextJobId++;
    pendingJobs.set(id, resolve);
    target.postMessage({ id, url: new URL(url, location.origin).href } satisfies BottleJob);
  });
}

/* --------------------------- Glavna nit (rezerva) --------------------------- */

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Slika nije učitana."));
    img.src = url;
  });
}

async function processOnMainThread(src: string, url: string): Promise<ProcessedBottle> {
  const fallback = { src, color: FALLBACK_LIQUID_COLOR, processed: false };

  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    return { src: PRODUCT_IMAGE_FALLBACK, color: FALLBACK_LIQUID_COLOR, processed: false };
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas.width || !canvas.height) return fallback;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { color, bounds } = processBottlePixels(imageData.data, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);

    let output = canvas;
    if (bounds) {
      output = document.createElement("canvas");
      output.width = bounds.sw;
      output.height = bounds.sh;
      output.getContext("2d")?.drawImage(canvas, bounds.sx, bounds.sy, bounds.sw, bounds.sh, 0, 0, bounds.sw, bounds.sh);
    }

    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/webp", 0.92));
    if (!blob) return { ...fallback, color: color ?? FALLBACK_LIQUID_COLOR };
    return { src: URL.createObjectURL(blob), color: color ?? FALLBACK_LIQUID_COLOR, processed: true };
  } catch {
    return fallback;
  }
}

/* ---------------------------------------------------------------------------- */

async function process(src: string, width: BottleImageWidth): Promise<ProcessedBottle> {
  if (typeof window === "undefined" || src.startsWith("data:")) {
    return { src, color: FALLBACK_LIQUID_COLOR, processed: false };
  }

  const url = optimizedUrl(src, width);
  const target = getWorker();
  if (!target) return processOnMainThread(src, url);

  const result = await processInWorker(target, url);
  if (result.ok) {
    return { src: URL.createObjectURL(result.blob), color: result.color ?? FALLBACK_LIQUID_COLOR, processed: true };
  }
  // Image doesn't exist -> a clean "No image" tile; processing error -> the original image.
  if (result.reason === "load") return { src: PRODUCT_IMAGE_FALLBACK, color: FALLBACK_LIQUID_COLOR, processed: false };
  return { src, color: FALLBACK_LIQUID_COLOR, processed: false };
}

export function processBottleImage(src: string, width: BottleImageWidth) {
  const key = `${width}|${src}`;
  let job = cache.get(key);

  if (!job) {
    // With a worker, jobs run alongside the page; without one, one at a time.
    job = getWorker() ? process(src, width) : queue.then(() => process(src, width));
    if (!getWorker()) queue = job.catch(() => undefined);
    cache.set(key, job);
  }

  return job;
}
