import type { BundleRow } from "./bundles";

export const BUNDLE_ML_OPTIONS = [2, 3, 5, 10] as const;

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "dj")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export { slugify as bundleSlug };

/** Bundle validation (admin form and server). Throws with a message for the admin. */
export function validateBundle(input: Record<string, unknown>): BundleRow {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 2 || title.length > 80) throw new Error("Naziv paketa: 2–80 znakova.");

  const id = slugify(typeof input.id === "string" && input.id.trim() ? input.id : title);
  if (!id) throw new Error("Naziv mora imati bar jedno slovo ili broj.");

  const ml = Number(input.ml);
  if (!Number.isInteger(ml) || ml < 1 || ml > 50) throw new Error("Zapremina po parfemu mora biti 1–50 ml.");

  const discount = Number(input.discount_pct);
  if (!Number.isInteger(discount) || discount < 0 || discount > 60) throw new Error("Popust paketa: 0–60%.");

  const perfumeIds = Array.isArray(input.perfume_ids)
    ? [...new Set(input.perfume_ids.filter((value): value is string => typeof value === "string" && value.trim() !== ""))]
    : [];
  if (perfumeIds.length < 2 || perfumeIds.length > 10) throw new Error("Paket mora imati 2–10 parfema.");

  return {
    id,
    title,
    description: typeof input.description === "string" ? input.description.trim().slice(0, 300) : "",
    ml,
    discount_pct: discount,
    perfume_ids: perfumeIds,
    is_active: input.is_active !== false,
    sort_order: Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0,
  };
}
