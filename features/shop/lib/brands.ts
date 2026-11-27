/**
 * Brand pages (/brendovi/dior): brand name -> URL slug, and perfumes grouped by brand. Pure logic.
 */

/** "Abercrombie & Fitch" -> "abercrombie-fitch", "Đorđe" -> "djordje", "Maison Francis Kurkdjian" -> "maison-francis-kurkdjian". */
export function brandSlug(brand: string) {
  return brand
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type BrandGroup<T> = { slug: string; name: string; products: T[] };

/** Perfumes grouped by brand (A–Z by name), keeping the order the products came in within a brand. */
export function groupByBrand<T extends { brand: string }>(products: T[]): BrandGroup<T>[] {
  const groups = new Map<string, BrandGroup<T>>();
  for (const product of products) {
    const slug = brandSlug(product.brand);
    if (!slug) continue;
    const group = groups.get(slug) ?? { slug, name: product.brand.trim(), products: [] };
    group.products.push(product);
    groups.set(slug, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "sr"));
}

/** First letter for the A–Z index ("#" for digits and symbols). */
export function brandInitial(name: string) {
  const letter = name.trim().charAt(0).toLocaleUpperCase("sr");
  return /[A-ZŠĐČĆŽ]/.test(letter) ? letter : "#";
}

/** Brand page link. */
export function brandHref(brand: string) {
  return `/brendovi/${brandSlug(brand)}`;
}
