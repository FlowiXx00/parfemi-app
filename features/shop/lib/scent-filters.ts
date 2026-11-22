/**
 * Scent and "when to wear" filters in the shop. Scent families are derived from accords
 * (same names as in the database), seasons from the "when to wear" values.
 */
import type { Accord, Wear, WearKey } from "./scent";

export type ScentFamilyKey = "fresh" | "sweet" | "woody" | "floral" | "fruity" | "spicy" | "warm";

export const SCENT_FAMILIES: { key: ScentFamilyKey; label: string; accords: string[] }[] = [
  { key: "fresh", label: "Sveži", accords: ["svež", "citrusni", "morski", "ozonski", "zeleni", "aromatični", "čajni", "metalni"] },
  { key: "sweet", label: "Slatki", accords: ["slatki", "vanila", "karamela", "medeni", "kakao", "kafa", "bademov", "kremasti", "kokos"] },
  { key: "woody", label: "Drvenasti", accords: ["drvenast", "oud", "pačuli", "zemljani"] },
  { key: "floral", label: "Cvetni", accords: ["cvetni", "ružin", "pudrasti"] },
  { key: "fruity", label: "Voćni", accords: ["voćni"] },
  { key: "spicy", label: "Začinski", accords: ["topli začinski", "začinski"] },
  { key: "warm", label: "Topli (ambra, koža, duvan)", accords: ["ambra", "balzamični", "duvanski", "kožni", "dimni", "animalni", "alkoholni", "mošusni"] },
];

export const SEASON_KEYS: WearKey[] = ["spring", "summer", "fall", "winter"];
export const TIME_KEYS: WearKey[] = ["day", "night"];

/** An accord must be pronounced (strength 55% or more) for the perfume to belong to that family. */
const FAMILY_MIN_STRENGTH = 55;
/** A season/time of day counts if its "when to wear" value is at least 70%. */
const WEAR_MIN = 70;

export function scentFamiliesOf(accords: Accord[]): Set<ScentFamilyKey> {
  const strong = accords.filter((accord) => accord.strength >= FAMILY_MIN_STRENGTH).map((accord) => accord.name.toLowerCase());
  const result = new Set<ScentFamilyKey>();
  for (const family of SCENT_FAMILIES) {
    if (strong.some((name) => family.accords.includes(name))) result.add(family.key);
  }
  return result;
}

export function wearKeysOf(wear: Wear): Set<WearKey> {
  const result = new Set<WearKey>();
  for (const key of [...SEASON_KEYS, ...TIME_KEYS]) {
    if ((wear[key] ?? 0) >= WEAR_MIN) result.add(key);
  }
  return result;
}

/** URL values (?miris=svezi,slatki&sezona=leto,noc) <-> keys. */
export const FAMILY_SLUGS: Record<string, ScentFamilyKey> = {
  svezi: "fresh", slatki: "sweet", drvenasti: "woody", cvetni: "floral", vocni: "fruity", zacinski: "spicy", topli: "warm",
};
export const WEAR_SLUGS: Record<string, WearKey> = {
  prolece: "spring", leto: "summer", jesen: "fall", zima: "winter", dan: "day", noc: "night",
};

export function parseSlugList<T extends string>(value: string | null, map: Record<string, T>): Set<T> {
  const result = new Set<T>();
  for (const part of (value ?? "").toLowerCase().split(",")) {
    const key = map[part.trim()];
    if (key) result.add(key);
  }
  return result;
}
