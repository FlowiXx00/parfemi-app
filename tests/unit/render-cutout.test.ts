import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderCutout } from "@/features/admin/perfumes/lib/render-cutout";

/** 400×600 white "product photo" with an amber 100×300 "bottle" in the middle. */
async function fakeProductPhoto() {
  const bottle = await sharp({
    create: { width: 100, height: 300, channels: 3, background: { r: 201, g: 138, b: 58 } },
  })
    .png()
    .toBuffer();
  return await sharp({ create: { width: 400, height: 600, channels: 3, background: "#ffffff" } })
    .composite([{ input: bottle, left: 150, top: 150 }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("server bottle cutout (same pixel code as the browser)", () => {
  it("removes the white background, crops to the bottle and finds the liquid color", async () => {
    const result = await renderCutout(await fakeProductPhoto(), 384);
    const image = sharp(result.webp);
    const meta = await image.metadata();

    expect(meta.format).toBe("webp");
    expect(meta.hasAlpha).toBe(true);
    // Resized to 384 wide (×0.96), then cropped to roughly the bottle (96×288 plus a soft edge).
    expect(result.width).toBeLessThan(140);
    expect(result.height).toBeGreaterThan(250);
    expect(result.height).toBeLessThan(330);

    // The bottle itself stays opaque.
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const center = ((info.height >> 1) * info.width + (info.width >> 1)) * 4;
    expect(data[center + 3]).toBeGreaterThan(200);

    expect(result.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("never enlarges a small image", async () => {
    const small = await sharp({ create: { width: 120, height: 200, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const result = await renderCutout(small, 828);
    expect(result.width).toBeLessThanOrEqual(120);
  });
});
