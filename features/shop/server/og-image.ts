import "server-only";
import sharp from "sharp";

/**
 * Perfume image for the Open Graph card. The image generator (next/og) can't read AVIF/WebP,
 * so it's downloaded and converted to PNG (data URL). Returns null on error and the card renders
 * without the bottle.
 */
export async function bottlePngDataUrl(url: string | null | undefined, height = 520): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    const png = await sharp(input)
      .resize({ height, width: height, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
