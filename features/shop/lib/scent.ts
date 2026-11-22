/** Accords, notes and "when to wear": normalizing database data and accord colors. */

export type Accord = { name: string; strength: number };

export type Notes = { top: string[]; middle: string[]; base: string[] };

export type WearKey = "spring" | "summer" | "fall" | "winter" | "day" | "night";
export type Wear = Partial<Record<WearKey, number>>;

export const SEASONS: { key: WearKey; label: string }[] = [
  { key: "spring", label: "Proleće" },
  { key: "summer", label: "Leto" },
  { key: "fall", label: "Jesen" },
  { key: "winter", label: "Zima" },
];

export const DAY_NIGHT: { key: WearKey; label: string }[] = [
  { key: "day", label: "Dan" },
  { key: "night", label: "Noć" },
];

const clampPercent = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
};

const toStringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim())
    : [];

export function normalizeAccords(value: unknown): Accord[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      return {
        name: typeof row.name === "string" ? row.name.trim() : "",
        strength: clampPercent(row.strength),
      };
    })
    .filter((accord) => accord.name && accord.strength > 0)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10);
}

export function normalizeNotes(value: unknown): Notes {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    top: toStringList(row.top),
    middle: toStringList(row.middle),
    base: toStringList(row.base),
  };
}

export function normalizeWear(value: unknown): Wear {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const wear: Wear = {};
  for (const key of ["spring", "summer", "fall", "winter", "day", "night"] as WearKey[]) {
    if (row[key] !== undefined) wear[key] = clampPercent(row[key]);
  }
  return wear;
}

/** Accord bar color by name (Serbian keywords), otherwise a neutral gold. */
const ACCORD_COLORS: [RegExp, string][] = [
  [/oud/, "#5b3a24"],
  [/drven|kedar|sandal/, "#8a5a32"],
  [/duvan/, "#7a5636"],
  [/kož/, "#5e4033"],
  [/med/, "#d9a03a"],
  [/vanil/, "#e7cf9a"],
  [/karamel|gurman/, "#c27a3a"],
  [/slat/, "#e38aa6"],
  [/citrus|limun|pomorand/, "#e8d24a"],
  [/voć/, "#ef7a5a"],
  [/ruž|cvet|jasmin/, "#e46a8f"],
  [/svež|morsk|akvat|ozon/, "#6cc3d5"],
  [/aromat|lavand|biljn|zelen/, "#6fa86a"],
  [/začin|cimet|biber/, "#b5532f"],
  [/ambr|smol/, "#c8873a"],
  [/mošus|pudr/, "#c9bfd8"],
  [/dim/, "#6e6a66"],
];

export function accordColor(name: string) {
  const lower = name.toLowerCase();
  return ACCORD_COLORS.find(([pattern]) => pattern.test(lower))?.[1] ?? "#c7a567";
}
