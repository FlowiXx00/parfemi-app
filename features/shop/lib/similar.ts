/**
 * "Similar perfumes": similarity by accords (mainly) and notes, respecting gender.
 * Computed on the server from the cached catalog (no extra database queries).
 */
import type { Accord, Notes } from "./scent";

type Scented = {
  id: string;
  brand: string;
  name: string;
  gender: string;
  accords: Accord[];
  notes: Notes;
  variants: { inStock: boolean }[];
};

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function accordVector(accords: Accord[]) {
  const vector = new Map<string, number>();
  for (const accord of accords) vector.set(fold(accord.name), accord.strength / 100);
  return vector;
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [key, value] of a) {
    normA += value * value;
    const other = b.get(key);
    if (other) dot += value * other;
  }
  for (const value of b.values()) normB += value * value;
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

function noteSet(notes: Notes) {
  return new Set([...notes.top, ...notes.middle, ...notes.base].map(fold));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared++;
  return shared / (a.size + b.size - shared);
}

/** A men's perfume never recommends a women's one and vice versa; unisex goes with everything. */
function genderFits(target: string, candidate: string) {
  if (target === "Unisex" || candidate === "Unisex") return true;
  return target === candidate;
}

/**
 * Most similar perfumes from the catalog. At most `perBrand` per brand (so recommendations aren't
 * just flankers of the same perfume), available ones only.
 */
export function findSimilar<T extends Scented>(target: Scented, catalog: T[], limit = 8, perBrand = 2): T[] {
  const targetAccords = accordVector(target.accords);
  const targetNotes = noteSet(target.notes);
  if (!targetAccords.size && !targetNotes.size) return [];

  const scored = catalog
    .filter((p) => p.id !== target.id && genderFits(target.gender, p.gender) && p.variants.some((v) => v.inStock))
    .map((p) => ({
      product: p,
      score: 0.65 * cosine(targetAccords, accordVector(p.accords)) + 0.35 * jaccard(targetNotes, noteSet(p.notes)),
    }))
    .filter((entry) => entry.score > 0.25)
    .sort((a, b) => b.score - a.score);

  const result: T[] = [];
  const perBrandCount = new Map<string, number>();
  for (const { product } of scored) {
    const count = perBrandCount.get(product.brand) ?? 0;
    if (count >= perBrand) continue;
    perBrandCount.set(product.brand, count + 1);
    result.push(product);
    if (result.length >= limit) break;
  }
  return result;
}
