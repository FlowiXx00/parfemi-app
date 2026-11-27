/**
 * "Nedavno pregledano": the last perfumes the visitor opened, kept only in their browser
 * (localStorage, no account and no server). Pure list logic here, tested.
 */

export const RECENTLY_VIEWED_KEY = "atelier-dekant:recently-viewed";
export const RECENTLY_VIEWED_MAX = 12;

/** The opened perfume goes first; no duplicates; at most `max` entries. */
export function pushRecentlyViewed(list: string[], id: string, max = RECENTLY_VIEWED_MAX) {
  return [id, ...list.filter((item) => item !== id)].slice(0, max);
}

/** Whatever is in storage -> a clean list of IDs. */
export function parseRecentlyViewed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 200).slice(0, RECENTLY_VIEWED_MAX)
      : [];
  } catch {
    return [];
  }
}
