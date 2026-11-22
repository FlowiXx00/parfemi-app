/**
 * Pixel processing for bottle images: pure functions with no DOM, so they also run in a Web Worker:
 * removing a plain light background, estimating the liquid color and finding the bottle bounds.
 */
function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/** Whether the image already has a transparent background (most edge pixels are transparent). */
function hasTransparentBackground(data: Uint8ClampedArray, width: number, height: number) {
  let transparent = 0;
  let count = 0;
  const check = (p: number) => {
    count++;
    if (data[p * 4 + 3]! < 24) transparent++;
  };
  for (let x = 0; x < width; x++) {
    check(x);
    check((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    check(y * width);
    check(y * width + width - 1);
  }
  return transparent / count > 0.6;
}

/** How far a pixel may differ from the background color (per channel) to count as background. */
const REF_TOLERANCE = 22;
/** Largest step between neighbouring shadow pixels (shadows are soft gradients, bottle edges are sharp). */
const SHADOW_STEP = 5;
/** Darkest shadow that still gets removed (difference from the background color per channel). */
const SHADOW_MAX_DIFF = 60;

/**
 * Color of a plain light background (median of edge pixels), or null
 * if the edges aren't uniform or are dark (then the background is left alone).
 */
function detectPlainBackground(data: Uint8ClampedArray, width: number, height: number) {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const step = Math.max(1, Math.floor((width + height) / 400));
  const sample = (p: number) => {
    const i = p * 4;
    if (data[i + 3]! < 200) return;
    rs.push(data[i]!);
    gs.push(data[i + 1]!);
    bs.push(data[i + 2]!);
  };
  for (let x = 0; x < width; x += step) {
    sample(x);
    sample((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += step) {
    sample(y * width);
    sample(y * width + width - 1);
  }
  if (rs.length < 20) return null;

  const median = (values: number[]) => values.slice().sort((a, b) => a - b)[values.length >> 1]!;
  const r = median(rs);
  const g = median(gs);
  const b = median(bs);
  if (Math.min(r, g, b) < 150) return null; // tamna pozadina -> ne diramo

  let close = 0;
  for (let k = 0; k < rs.length; k++) {
    const d = Math.max(Math.abs(rs[k]! - r), Math.abs(gs[k]! - g), Math.abs(bs[k]! - b));
    if (d <= 16) close++;
  }
  return close / rs.length >= 0.7 ? { r, g, b } : null;
}

/**
 * Clear glass (e.g. Creed) has the same color as the background behind it, so the flood fill
 * "eats" it. A pixel enclosed by the bottle on all four sides (left/right in its row, up/down in its
 * column)
 * is inside the bottle -> restored. Notches around the cap and side shadows stay background.
 */
function restoreEnclosedPixels(isBackground: Uint8Array, width: number, height: number) {
  const total = width * height;

  // Non-background regions split into connected components. Small specks (shadow leftovers, noise) are
  // removed and don't count towards the bottle bounds; otherwise they'd "fence in" half the background.
  const component = new Int32Array(total).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(total);
  for (let start = 0; start < total; start++) {
    if (isBackground[start] || component[start] !== -1) continue;
    const label = sizes.length;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    component[start] = label;
    const visit = (n: number) => {
      if (isBackground[n] || component[n] !== -1) return;
      component[n] = label;
      stack[top++] = n;
    };
    while (top > 0) {
      const p = stack[--top]!;
      size++;
      const x = p % width;
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p < total - width) visit(p + width);
    }
    sizes.push(size);
  }
  if (!sizes.length) return;

  const minSize = Math.max(...sizes) * 0.02;
  for (let p = 0; p < total; p++) {
    const label = component[p]!;
    if (label >= 0 && sizes[label]! < minSize) isBackground[p] = 1;
  }

  const rowMin = new Int32Array(height).fill(width);
  const rowMax = new Int32Array(height).fill(-1);
  const colMin = new Int32Array(width).fill(height);
  const colMax = new Int32Array(width).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBackground[y * width + x]) continue;
      if (x < rowMin[y]!) rowMin[y] = x;
      if (x > rowMax[y]!) rowMax[y] = x;
      if (y < colMin[x]!) colMin[x] = y;
      if (y > colMax[x]!) colMax[x] = y;
    }
  }

  for (let y = 0; y < height; y++) {
    const left = rowMin[y]!;
    const right = rowMax[y]!;
    for (let x = left + 1; x < right; x++) {
      const p = y * width + x;
      if (isBackground[p] && y > colMin[x]! && y < colMax[x]!) isBackground[p] = 0;
    }
  }
}

/**
 * Removes a white (or plain light) background connected to the image edge and returns the background
 * mask.
 * If the background is already transparent (e.g. official brand PNGs), white parts of the bottle
 * (frosted glass, white caps) are left alone; only transparent pixels are marked as background.
 */
function removeWhiteBackground(data: Uint8ClampedArray, width: number, height: number) {
  const total = width * height;
  const isBackground = new Uint8Array(total);

  if (hasTransparentBackground(data, width, height)) {
    let backgroundCount = 0;
    for (let p = 0; p < total; p++) {
      if (data[p * 4 + 3]! < 24) {
        isBackground[p] = 1;
        backgroundCount++;
      }
    }
    return { isBackground, backgroundRatio: backgroundCount / total };
  }
  const stack = new Int32Array(total);
  let top = 0;

  // Many brands shoot on a plain light background (beige, light grey) rather than white. The background
  // color is sampled from the image edges; if they aren't uniform, only the white rule applies.
  const ref = detectPlainBackground(data, width, height);

  const channelDiff = (p: number, r: number, g: number, b: number) => {
    const i = p * 4;
    return Math.max(Math.abs(data[i]! - r), Math.abs(data[i + 1]! - g), Math.abs(data[i + 2]! - b));
  };

  const looksLikeBackground = (p: number, from: number) => {
    const i = p * 4;
    const a = data[i + 3]!;
    if (a < 24) return true; // already transparent
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min >= 228 && max - min <= 20) return true; // belo
    if (!ref) return false;

    const fromRef = channelDiff(p, ref.r, ref.g, ref.b);
    if (fromRef <= REF_TOLERANCE) return true;
    // Soft shadow (flat-lay photos): a gentle step from the neighbouring background pixel;
    // sharp bottle edges stop the spread, with a cap on how far it may drift from the background. Note:
    // clear glass on a grey background can't be separated reliably this way; such bottles need a PNG with
    // a transparent background.
    if (from < 0 || fromRef > SHADOW_MAX_DIFF) return false;
    const fi = from * 4;
    return channelDiff(p, data[fi]!, data[fi + 1]!, data[fi + 2]!) <= SHADOW_STEP;
  };

  const push = (p: number, from: number) => {
    if (!isBackground[p] && looksLikeBackground(p, from)) {
      isBackground[p] = 1;
      stack[top++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    push(x, -1);
    push((height - 1) * width + x, -1);
  }
  for (let y = 0; y < height; y++) {
    push(y * width, -1);
    push(y * width + width - 1, -1);
  }

  while (top > 0) {
    const p = stack[--top]!;
    const x = p % width;
    if (x > 0) push(p - 1, p);
    if (x < width - 1) push(p + 1, p);
    if (p >= width) push(p - width, p);
    if (p < total - width) push(p + width, p);
  }

  restoreEnclosedPixels(isBackground, width, height);

  let backgroundCount = 0;
  for (let p = 0; p < total; p++) {
    if (isBackground[p]) {
      data[p * 4 + 3] = 0;
      backgroundCount++;
    }
  }

  // Soft edge: light pixels next to the background become partly transparent (no white halo).
  for (let p = 0; p < total; p++) {
    if (isBackground[p]) continue;
    const x = p % width;
    const nearBackground =
      (x > 0 && isBackground[p - 1]) ||
      (x < width - 1 && isBackground[p + 1]) ||
      (p >= width && isBackground[p - width]) ||
      (p < total - width && isBackground[p + width]);
    if (!nearBackground) continue;

    const i = p * 4;
    if (ref) {
      // The closer a pixel is to the background color, the more transparent it gets.
      const d = channelDiff(p, ref.r, ref.g, ref.b);
      if (d < 60) data[i + 3] = Math.round(data[i + 3]! * (d / 60));
      continue;
    }
    const min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
    if (min > 190) {
      data[i + 3] = Math.round(data[i + 3]! * Math.max(0, (255 - min) / 65));
    }
  }

  return { isBackground, backgroundRatio: backgroundCount / total };
}

/** Average color of saturated bottle pixels (liquid/glass), or null. */
function estimateLiquidColor(
  data: Uint8ClampedArray,
  isBackground: Uint8Array,
  total: number
) {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  let opaque = 0;
  let colorful = 0;

  for (let p = 0; p < total; p++) {
    if (isBackground[p]) continue;
    const i = p * 4;
    if (data[i + 3]! < 200) continue;
    opaque++;

    const pr = data[i]!;
    const pg = data[i + 1]!;
    const pb = data[i + 2]!;
    const { s, l } = rgbToHsl(pr, pg, pb);
    if (s < 0.22 || l < 0.16 || l > 0.86) continue;

    colorful++;
    const w = s * (1 - Math.abs(l - 0.52));
    r += pr * w;
    g += pg * w;
    b += pb * w;
    weight += w;
  }

  // Too little color (black/silver/clear bottle) -> no reliable estimate.
  if (weight === 0 || colorful < opaque * 0.04) return null;

  return toHex(r / weight, g / weight, b / weight);
}

/**
 * Bottle bounds (without empty transparent space), so every bottle sits right on the pedestal
 * and all are roughly the same size regardless of the original image margins. null = no crop needed.
 */
function findContentBounds(data: Uint8ClampedArray, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  // The bottom is computed from (almost) opaque pixels: the semi-transparent shadow under bottles in
  // official images looks like a light "plate" on a dark stage, so it gets cut off.
  let maxOpaqueY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]!;
      if (alpha > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (alpha > 180 && y > maxOpaqueY) maxOpaqueY = y;
    }
  }

  if (maxX < 0) return null;
  if (maxOpaqueY > minY) maxY = maxOpaqueY;

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width, maxX + pad + 1) - sx;
  const sh = Math.min(height, maxY + 1) - sy; // no gap at the bottom -> sits on the pedestal

  if (sw >= width && sh >= height) return null;
  return { sx, sy, sw, sh };
}

/** Full pixel pass (mutates `data`): returns the liquid color and the crop bounds. */
export function processBottlePixels(data: Uint8ClampedArray, width: number, height: number) {
  const { isBackground } = removeWhiteBackground(data, width, height);
  const color = estimateLiquidColor(data, isBackground, width * height);
  return { color, bounds: findContentBounds(data, width, height) };
}