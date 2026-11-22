import {
  isAllowedImageUrl,
  MAX_PRODUCT_IMAGES,
  normalizeImages,
} from "@/features/shop/lib/product-images";
import {
  normalizeConcentration,
  normalizeGender,
  normalizeHexColor,
} from "@/features/shop/types";
import {
  normalizeAccords,
  normalizeNotes,
  normalizeWear,
  type Notes,
  type Wear,
  type WearKey,
} from "@/features/shop/lib/scent";
import {
  ROUND_STEPS,
  type EditorState,
  type PerfumeAdminRow,
  type PerfumeCosts,
  type SavePerfumePayload,
  type VariantRow,
} from "../types";

export { normalizeConcentration, normalizeGender };

const WEAR_KEYS: WearKey[] = ["spring", "summer", "fall", "winter", "day", "night"];

function emptyWear(): Record<WearKey, number> {
  return { spring: 0, summer: 0, fall: 0, winter: 0, day: 0, night: 0 };
}

/** "bergamot, limun ,  vanila" -> ["bergamot", "limun", "vanila"] */
function splitNotes(text: string) {
  return [...new Set(text.split(/[,;\n]+/).map((note) => note.trim()).filter(Boolean))].slice(0, 20);
}

/** Whether the perfume has notes filled in (for the list badge). */
export function hasNotes(notes: Notes) {
  return notes.top.length + notes.middle.length + notes.base.length > 0;
}

// The price stays empty until the admin clicks "Calculate prices" (or types it in).
const DEFAULT_VARIANTS: VariantRow[] = [
  { ml: 3, price_rsd: "", in_stock: true },
  { ml: 5, price_rsd: "", in_stock: true },
  { ml: 10, price_rsd: "", in_stock: true },
];

const DEFAULT_ROUND_STEP = 50;

export type CostInput = {
  bottlePrice: number;
  bottleMl: number;
  marginPct: number;
  packaging: number;
  roundStep: number;
};

/** Editor -> numbers for the calculator; null if bottle price or bottle ml are missing. */
export function readCostInput(editor: EditorState): CostInput | null {
  const bottlePrice = Number(editor.bottlePrice);
  const bottleMl = Number(editor.bottleMl);
  if (!(bottlePrice > 0) || !(bottleMl > 0)) return null;
  return {
    bottlePrice,
    bottleMl,
    marginPct: Math.max(0, Number(editor.marginPct) || 0),
    packaging: Math.max(0, Number(editor.packaging) || 0),
    roundStep: editor.roundStep || DEFAULT_ROUND_STEP,
  };
}

/**
 * Decant price:
 * cost = (bottle price / bottle ml) × ml + packaging
 * price = cost × (1 + margin%), rounded up to the step (e.g. 50 RSD)
 */
export function decantPrice(ml: number, cost: CostInput) {
  const purchase = (cost.bottlePrice / cost.bottleMl) * ml + cost.packaging;
  const raw = purchase * (1 + cost.marginPct / 100);
  const step = cost.roundStep || 1;
  const price = Math.max(step, Math.ceil(raw / step) * step);
  return { purchase: Math.round(purchase), price, profit: Math.round(price - purchase) };
}

export function createDefaultVariants(): VariantRow[] {
  return DEFAULT_VARIANTS.map((variant) => ({ ...variant }));
}

export function emptyEditor(): EditorState {
  return {
    id: "",
    name: "",
    brand: "",
    description: "",
    gender: "Unisex",
    concentration: "Eau de parfum",
    on_sale: false,
    rating: "",
    votes: "",
    images: [{ url: "", label: "Parfem" }],
    liquid_color: "",
    is_featured: false,
    is_active: true,
    notesTop: "",
    notesMiddle: "",
    notesBase: "",
    accords: [],
    wear: emptyWear(),
    bottlePrice: "",
    bottleMl: 100,
    marginPct: "",
    packaging: "",
    roundStep: DEFAULT_ROUND_STEP,
    variants: createDefaultVariants(),
  };
}

function normalizeCosts(value: unknown): PerfumeCosts | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const step = Number(r.round_step);
  return {
    bottle_price_rsd: num(r.bottle_price_rsd),
    bottle_ml: num(r.bottle_ml),
    margin_pct: num(r.margin_pct),
    packaging_rsd: Number(r.packaging_rsd) || 0,
    round_step: (ROUND_STEPS as readonly number[]).includes(step) ? step : DEFAULT_ROUND_STEP,
  };
}

function normalizeVariants(value: unknown): VariantRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: unknown) => {
      const row =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};

      return {
        ml: typeof row.ml === "number" ? row.ml : Number(row.ml),
        price_rsd:
          typeof row.price_rsd === "number"
            ? row.price_rsd
            : Number(row.price_rsd),
        in_stock: Boolean(row.in_stock),
      };
    })
    .filter(
      (variant) =>
        Number.isFinite(variant.ml) &&
        Number(variant.ml) > 0 &&
        Number.isFinite(variant.price_rsd) &&
        Number(variant.price_rsd) >= 0
    )
    .sort((a, b) => Number(a.ml) - Number(b.ml));
}

/** perfume_stock from the query (object or single-item array) -> ml, or null (not tracked). */
function readStockMl(value: unknown): number | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const ml = Number((row as Record<string, unknown>).stock_ml);
  return Number.isFinite(ml) ? ml : null;
}

/** Stock level for the list badge: out (not even the smallest volume can be sold) or low. */
const LOW_STOCK_ML = 30;
export function stockLevel(perfume: Pick<PerfumeAdminRow, "stock_ml" | "variants">): "none" | "out" | "low" | "ok" {
  if (perfume.stock_ml === null) return "none";
  const smallest = Math.min(...perfume.variants.map((v) => Number(v.ml) || Infinity));
  if (Number.isFinite(smallest) && perfume.stock_ml < smallest) return "out";
  return perfume.stock_ml < LOW_STOCK_ML ? "low" : "ok";
}

export function normalizePerfumeRow(raw: unknown): PerfumeAdminRow | null {
  const row =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : null;

  if (!row) return null;

  const id = typeof row.id === "string" ? row.id : "";
  const name = typeof row.name === "string" ? row.name : "";
  const brand = typeof row.brand === "string" ? row.brand : "";

  if (!id || !name || !brand) return null;

  const relationVariants = row.variants ?? row.perfume_variants ?? [];

  const rating =
    typeof row.rating === "number"
      ? row.rating
      : row.rating == null
        ? null
        : Number(row.rating);

  const votes =
    typeof row.votes === "number"
      ? row.votes
      : row.votes == null
        ? null
        : Number(row.votes);

  return {
    id,
    name,
    brand,
    description: typeof row.description === "string" ? row.description : null,
    gender: normalizeGender(row.gender),
    concentration: normalizeConcentration(row.concentration),
    on_sale: Boolean(row.on_sale),
    rating:
      rating !== null &&
        Number.isFinite(rating) &&
        rating >= 0 &&
        rating <= 5
        ? rating
        : null,
    votes:
      votes !== null &&
        Number.isFinite(votes) &&
        votes >= 0
        ? votes
        : null,
    images: normalizeImages(row.images),
    liquid_color: normalizeHexColor(row.liquid_color),
    is_featured: Boolean(row.is_featured),
    // Old rows without the column are treated as visible.
    is_active: row.is_active !== false,
    stock_ml: readStockMl(row.stock),
    accords: normalizeAccords(row.accords),
    notes: normalizeNotes(row.notes),
    wear: normalizeWear(row.wear),
    costs: normalizeCosts(row.costs),
    variants: normalizeVariants(relationVariants),
  };
}

export function toEditor(row: PerfumeAdminRow): EditorState {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    description: row.description ?? "",
    gender: row.gender,
    concentration: row.concentration,
    on_sale: row.on_sale,
    rating: row.rating ?? "",
    votes: row.votes ?? "",
    images: row.images.length > 0 ? row.images : [{ url: "", label: "Parfem" }],
    liquid_color: row.liquid_color ?? "",
    is_featured: row.is_featured,
    is_active: row.is_active,
    notesTop: row.notes.top.join(", "),
    notesMiddle: row.notes.middle.join(", "),
    notesBase: row.notes.base.join(", "),
    accords: row.accords.map((accord) => ({ ...accord })),
    wear: { ...emptyWear(), ...row.wear },
    bottlePrice: row.costs?.bottle_price_rsd ?? "",
    bottleMl: row.costs?.bottle_ml ?? 100,
    marginPct: row.costs?.margin_pct ?? "",
    packaging: row.costs?.packaging_rsd || "",
    roundStep: row.costs?.round_step ?? DEFAULT_ROUND_STEP,
    variants: row.variants.length > 0 ? row.variants : createDefaultVariants(),
  };
}

/** "Xerjoff" + "Erba Pura" -> "xerjoff-erba-pura" (ID parfema) */
export function slugify(...parts: string[]) {
  return parts
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "dj")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function filterPerfumes(list: PerfumeAdminRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return list;

  return list.filter(
    (perfume) =>
      perfume.name.toLowerCase().includes(q) ||
      perfume.brand.toLowerCase().includes(q) ||
      perfume.id.toLowerCase().includes(q)
  );
}

export function buildSavePayload(editor: EditorState): SavePerfumePayload {
  const id = editor.id.trim();
  const name = editor.name.trim();
  const brand = editor.brand.trim();

  if (!brand || !name) {
    throw new Error("Upiši brend i naziv parfema.");
  }
  if (!id) {
    throw new Error("Nedostaje adresa na sajtu (ID).");
  }

  if (!editor.variants.length) {
    throw new Error("Dodaj bar jednu zapreminu (npr. 5 ml).");
  }

  const missingPrice = editor.variants.find(
    (variant) => Number(variant.ml) > 0 && !(Number(variant.price_rsd) > 0)
  );
  if (missingPrice) {
    throw new Error(
      `Zapremina ${missingPrice.ml} ml nema cenu — upiši je ili klikni „Izračunaj cene”.`
    );
  }

  const normalizedVariants = editor.variants
    .map((variant) => ({
      ml: Number(variant.ml),
      price_rsd: Number(variant.price_rsd),
      in_stock: Boolean(variant.in_stock),
    }))
    .filter(
      (variant) =>
        Number.isFinite(variant.ml) &&
        variant.ml > 0 &&
        Number.isFinite(variant.price_rsd) &&
        variant.price_rsd >= 0
    )
    .sort((a, b) => a.ml - b.ml);

  if (!normalizedVariants.length) {
    throw new Error("Sve varijante su neispravne.");
  }

  const rating = editor.rating === "" ? null : Number(editor.rating);
  const votes = editor.votes === "" ? null : Number(editor.votes);

  if (rating !== null && !Number.isFinite(rating)) {
    throw new Error("Ocena nije ispravna.");
  }

  if (rating !== null && (rating < 0 || rating > 5)) {
    throw new Error("Ocena mora biti između 0 i 5.");
  }

  if (votes !== null && !Number.isFinite(votes)) {
    throw new Error("Broj glasova nije ispravan.");
  }

  if (votes !== null && votes < 0) {
    throw new Error("Broj glasova ne može biti negativan.");
  }

  // Empty rows are skipped; an invalid URL is an error so the admin sees it right away.
  const images = editor.images
    .map((image) => ({ url: image.url.trim(), label: image.label.trim() }))
    .filter((image) => image.url);

  const badImage = images.find((image) => !isAllowedImageUrl(image.url));
  if (badImage) {
    throw new Error(
      `Neispravan URL slike: "${badImage.url}". Mora počinjati sa https:// ili /.`
    );
  }

  if (images.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Najviše ${MAX_PRODUCT_IMAGES} slika po parfemu.`);
  }

  const liquidColor = editor.liquid_color ? normalizeHexColor(editor.liquid_color) : null;
  if (editor.liquid_color && !liquidColor) {
    throw new Error("Boja tečnosti mora biti u formatu #rrggbb.");
  }

  const accords = editor.accords
    .map((accord) => ({ name: accord.name.trim(), strength: Math.round(Number(accord.strength)) }))
    .filter((accord) => accord.name && accord.strength > 0)
    .map((accord) => ({ ...accord, strength: Math.min(100, accord.strength) }));

  // If no slider was moved, "when to wear" stays empty (and isn't shown in the shop).
  const wearValues = WEAR_KEYS.map((key) => Number(editor.wear[key]) || 0);
  const wear: Wear = wearValues.some((value) => value > 0)
    ? Object.fromEntries(WEAR_KEYS.map((key, i) => [key, Math.min(100, Math.max(0, wearValues[i]!))]))
    : {};

  return {
    id,
    name,
    brand,
    notes: {
      top: splitNotes(editor.notesTop),
      middle: splitNotes(editor.notesMiddle),
      base: splitNotes(editor.notesBase),
    },
    accords,
    wear,
    description: editor.description.trim() || null,
    gender: editor.gender,
    concentration: editor.concentration,
    on_sale: editor.on_sale,
    rating,
    votes,
    images,
    liquid_color: liquidColor,
    is_featured: editor.is_featured,
    is_active: editor.is_active,
    costs: {
      bottle_price_rsd: editor.bottlePrice === "" ? null : Math.max(0, Math.round(Number(editor.bottlePrice))),
      bottle_ml: editor.bottleMl === "" ? null : Math.max(1, Math.round(Number(editor.bottleMl))),
      margin_pct: editor.marginPct === "" ? null : Math.max(0, Number(editor.marginPct)),
      packaging_rsd: Math.max(0, Math.round(Number(editor.packaging) || 0)),
      round_step: editor.roundStep,
    },
    variants: normalizedVariants,
  };
}
