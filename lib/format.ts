/** Text formatting and normalization shared across the site. */

const rsdFormatter = new Intl.NumberFormat("sr-RS");

const dateTimeFormatter = new Intl.DateTimeFormat("sr-RS", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** 1234 -> "1.234 rsd" */
export function formatRsd(value: number) {
  return `${rsdFormatter.format(value)} rsd`;
}

/** ISO datum -> "15.11.2026. 14:30" */
export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

/** Lowercase, no diacritics, collapsed whitespace (for search). */
export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowest and highest price from a list of variants. */
export function getPriceBounds(variants: { priceRsd: number }[]) {
  if (!variants.length) {
    return { min: 0, max: 0 };
  }

  const prices = variants.map((variant) => variant.priceRsd);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
