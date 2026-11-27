/**
 * The image work of a cutout, without Storage or the database (so it can be tested): resize like the
 * browser used to (Next optimizer width, no upscaling), remove the plain background, crop to the bottle,
 * encode as WebP with transparency. Uses the same pixel code as the browser (bottle-pixels.ts).
 */
import sharp from "sharp";
import { processBottlePixels } from "@/features/shop/lib/bottle-pixels";

export async function renderCutout(input: Buffer, width: number) {
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const { color, bounds } = processBottlePixels(pixels, info.width, info.height);

  let image = sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength), {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  if (bounds && bounds.sw > 0 && bounds.sh > 0) {
    image = image.extract({ left: bounds.sx, top: bounds.sy, width: bounds.sw, height: bounds.sh });
  }

  return {
    webp: await image.webp({ quality: 86, alphaQuality: 90, effort: 4 }).toBuffer(),
    color,
    width: bounds?.sw ?? info.width,
    height: bounds?.sh ?? info.height,
  };
}
