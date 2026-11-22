/// <reference lib="webworker" />
/**
 * Web Worker: bottle image processing off the main thread (download, background removal,
 * liquid color, cropping), so the page stays smooth while cards appear.
 */
import { processBottlePixels } from "./bottle-pixels";

export type BottleJob = { id: number; url: string };
export type BottleResult =
  | { id: number; ok: true; blob: Blob; color: string | null }
  | { id: number; ok: false; reason: "load" | "process" };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<BottleJob>) => {
  const { id, url } = event.data;

  let bitmap: ImageBitmap;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    bitmap = await createImageBitmap(await response.blob());
  } catch {
    scope.postMessage({ id, ok: false, reason: "load" } satisfies BottleResult);
    return;
  }

  try {
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !width || !height) throw new Error("canvas");

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, width, height);
    const { color, bounds } = processBottlePixels(imageData.data, width, height);
    ctx.putImageData(imageData, 0, 0);

    let output: OffscreenCanvas = canvas;
    if (bounds) {
      output = new OffscreenCanvas(bounds.sw, bounds.sh);
      output.getContext("2d")?.drawImage(canvas, bounds.sx, bounds.sy, bounds.sw, bounds.sh, 0, 0, bounds.sw, bounds.sh);
    }

    // Safari can't encode webp -> it returns PNG instead (per spec), which is fine too.
    const blob = await output.convertToBlob({ type: "image/webp", quality: 0.92 });
    scope.postMessage({ id, ok: true, blob, color } satisfies BottleResult);
  } catch {
    scope.postMessage({ id, ok: false, reason: "process" } satisfies BottleResult);
  }
};
