/**
 * "Find your scent" quiz: questions and scoring of catalog perfumes.
 * Everything runs in the browser over the cached catalog (/api/catalog).
 */
import { SCENT_FAMILIES, scentFamiliesOf, type ScentFamilyKey } from "@/features/shop/lib/scent-filters";
import type { WearKey } from "@/features/shop/lib/scent";
import type { CatalogProduct } from "@/features/shop/types";
import { getPriceBounds } from "@/lib/format";

export type QuizAnswers = {
  gender: "Muški" | "Ženski" | "any" | null;
  families: ScentFamilyKey[];
  season: "warm" | "cold" | "all" | null;
  time: "day" | "night" | "both" | null;
  strength: "light" | "medium" | "strong" | null;
  budget: number | null; // max for the smallest volume; 0 = doesn't matter
};

export const EMPTY_ANSWERS: QuizAnswers = { gender: null, families: [], season: null, time: null, strength: null, budget: null };

export type QuizOption<T> = { value: T; label: string; hint?: string };

export const QUIZ_STEPS = [
  {
    key: "gender",
    title: "Za koga tražiš miris?",
    options: [
      { value: "Muški", label: "Za njega" },
      { value: "Ženski", label: "Za nju" },
      { value: "any", label: "Svejedno / unisex" },
    ] as QuizOption<QuizAnswers["gender"]>[],
  },
  {
    key: "families",
    title: "Koji mirisi te privlače?",
    hint: "Izaberi jedan ili dva (ili preskoči ako nisi siguran).",
    multi: 2,
    options: SCENT_FAMILIES.map((family) => ({ value: family.key, label: family.label })) as QuizOption<ScentFamilyKey>[],
  },
  {
    key: "season",
    title: "Kada ćeš ga najviše nositi?",
    options: [
      { value: "warm", label: "Leti i u proleće", hint: "toplo vreme" },
      { value: "cold", label: "Ujesen i zimi", hint: "hladno vreme" },
      { value: "all", label: "Cele godine" },
    ] as QuizOption<QuizAnswers["season"]>[],
  },
  {
    key: "time",
    title: "Za koje prilike?",
    options: [
      { value: "day", label: "Svaki dan, posao, škola" },
      { value: "night", label: "Večernji izlasci, posebne prilike" },
      { value: "both", label: "Za sve prilike" },
    ] as QuizOption<QuizAnswers["time"]>[],
  },
  {
    key: "strength",
    title: "Koliko jak miris voliš?",
    options: [
      { value: "light", label: "Lagan, nenametljiv", hint: "Eau de toilette / cologne" },
      { value: "medium", label: "Srednje jak", hint: "Eau de parfum" },
      { value: "strong", label: "Jak, da se oseti", hint: "Parfum / Extrait" },
    ] as QuizOption<QuizAnswers["strength"]>[],
  },
  {
    key: "budget",
    title: "Koliko želiš da daš za probu?",
    hint: "Cena najmanjeg dekanta.",
    options: [
      { value: 1500, label: "Do 1.500 rsd" },
      { value: 2500, label: "Do 2.500 rsd" },
      { value: 0, label: "Nije bitno" },
    ] as QuizOption<number>[],
  },
] as const;

const SEASON_KEYS: Record<NonNullable<QuizAnswers["season"]>, WearKey[]> = {
  warm: ["summer", "spring"],
  cold: ["winter", "fall"],
  all: [],
};

const STRENGTH_CONC: Record<NonNullable<QuizAnswers["strength"]>, string[]> = {
  light: ["Eau de toilette", "Eau de cologne"],
  medium: ["Eau de parfum"],
  strong: ["Parfum", "Extrait de parfum"],
};

/** Perfume score for the answers (higher = better); null = doesn't fit (gender, budget, out of stock). */
function scorePerfume(product: CatalogProduct, answers: QuizAnswers): number | null {
  if (!product.variants.some((variant) => variant.inStock)) return null;
  if (answers.gender && answers.gender !== "any" && product.gender !== answers.gender && product.gender !== "Unisex") {
    return null;
  }
  const { min } = getPriceBounds(product.variants.filter((variant) => variant.inStock));
  if (answers.budget && min > answers.budget) return null;

  let score = 0;

  // Scent families: how strong the strongest accord from the chosen family is.
  if (answers.families.length) {
    const families = scentFamiliesOf(product.accords);
    for (const key of answers.families) {
      const family = SCENT_FAMILIES.find((item) => item.key === key)!;
      // The first 5 accords of a family are the "core" ones (e.g. citrus, fresh, marine); the rest
      // (aromatic…) count less.
      const strongest = Math.max(
        0,
        ...product.accords.map((accord) => {
          const index = family.accords.indexOf(accord.name.toLowerCase());
          return index === -1 ? 0 : accord.strength * (index < 5 ? 1 : 0.6);
        })
      );
      score += (strongest / 100) * 3 + (families.has(key) ? 0.5 : 0);
    }
    // None of the chosen families is pronounced -> the perfume ranks lower.
    if (!answers.families.some((key) => families.has(key))) score -= 1.5;
  }

  const wearValue = (key: WearKey) => (product.wear[key] ?? 50) / 100;
  if (answers.season && answers.season !== "all") {
    const keys = SEASON_KEYS[answers.season];
    score += (keys.reduce((sum, key) => sum + wearValue(key), 0) / keys.length) * 2;
  }
  if (answers.time && answers.time !== "both") score += wearValue(answers.time) * 1.5;

  if (answers.strength) {
    if (STRENGTH_CONC[answers.strength].includes(product.concentration)) score += 1;
    else if (answers.strength === "medium") score += 0.4;
  }

  // Quality and popularity (Fragrantica) as a small bonus.
  score += ((product.rating ?? 3.8) / 5) * 0.8 + (Math.log10((product.votes ?? 0) + 1) / 5) * 0.5;
  return score;
}

export function recommend(catalog: CatalogProduct[], answers: QuizAnswers, limit = 6) {
  return catalog
    .map((product) => ({ product, score: scorePerfume(product, answers) }))
    .filter((entry): entry is { product: CatalogProduct; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.product);
}

/** "See all like these in the shop" link with the same filters. */
export function shopLinkFor(answers: QuizAnswers) {
  const familySlug: Record<ScentFamilyKey, string> = {
    fresh: "svezi", sweet: "slatki", woody: "drvenasti", floral: "cvetni", fruity: "vocni", spicy: "zacinski", warm: "topli",
  };
  const params = new URLSearchParams();
  if (answers.families.length) params.set("miris", answers.families.map((key) => familySlug[key]).join(","));
  const wear: string[] = [];
  if (answers.season === "warm") wear.push("leto");
  if (answers.season === "cold") wear.push("zima");
  if (answers.time === "day") wear.push("dan");
  if (answers.time === "night") wear.push("noc");
  if (wear.length) params.set("sezona", wear.join(","));
  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}
