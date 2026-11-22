/**
 * Perfume names are stored WITHOUT the brand ("Guidance"), and the brand separately ("Amouage").
 * These helpers strip the brand if someone typed "Amouage Guidance" anyway, and
 * join the full name where a single string is needed (orders, SEO, alt text).
 */

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .toLowerCase();

/** "Amouage" + "Amouage Guidance" -> "Guidance". If the name didn't start with the brand, it's returned unchanged. */
export function stripBrandPrefix(brand: string | null | undefined, name: string): string {
  const cleanName = name.trim();
  const cleanBrand = (brand ?? "").trim();
  if (!cleanBrand) return cleanName;

  const foldedName = fold(cleanName);
  const foldedBrand = fold(cleanBrand);
  if (!foldedName.startsWith(foldedBrand)) return cleanName;

  // The brand must be a whole word ("Creed Aventus" yes, "Creedence" no).
  const rest = cleanName.slice(cleanBrand.length);
  if (!/^[\s\-–—:·|]+/.test(rest)) return cleanName;

  const stripped = rest.replace(/^[\s\-–—:·|]+/, "").trim();
  return stripped || cleanName;
}

/** Full name for single-line display: "Amouage Guidance". */
export function fullProductName(product: { brand?: string | null; name: string }): string {
  const name = stripBrandPrefix(product.brand, product.name);
  const brand = (product.brand ?? "").trim();
  return brand ? `${brand} ${name}` : name;
}
