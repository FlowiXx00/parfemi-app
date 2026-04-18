import {
  CONCENTRATIONS,
  GENDERS,
  type Concentration,
  type EditorState,
  type Gender,
  type PerfumeAdminRow,
  type SavePerfumePayload,
  type VariantRow,
} from "../types";

const DEFAULT_VARIANTS: VariantRow[] = [
  { ml: 3, price_rsd: 0, in_stock: true },
  { ml: 5, price_rsd: 0, in_stock: true },
  { ml: 10, price_rsd: 0, in_stock: true },
];

export function createDefaultVariants(): VariantRow[] {
  return DEFAULT_VARIANTS.map((variant) => ({ ...variant }));
}

export function emptyEditor(): EditorState {
  return {
    id: "",
    name: "",
    brand: "",
    image_url: "",
    description: "",
    gender: "Unisex",
    concentration: "Eau de parfum",
    on_sale: false,
    rating: "",
    votes: "",
    variants: createDefaultVariants(),
  };
}

export function normalizeGender(value: unknown): Gender {
  return GENDERS.includes(value as Gender) ? (value as Gender) : "Unisex";
}

export function normalizeConcentration(value: unknown): Concentration {
  return CONCENTRATIONS.includes(value as Concentration)
    ? (value as Concentration)
    : "Eau de parfum";
}

export function normalizeVariants(value: unknown): VariantRow[] {
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
    image_url: typeof row.image_url === "string" ? row.image_url : null,
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
    variants: normalizeVariants(relationVariants),
  };
}

export function toEditor(row: PerfumeAdminRow): EditorState {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    image_url: row.image_url ?? "",
    description: row.description ?? "",
    gender: row.gender,
    concentration: row.concentration,
    on_sale: row.on_sale,
    rating: row.rating ?? "",
    votes: row.votes ?? "",
    variants: row.variants.length > 0 ? row.variants : createDefaultVariants(),
  };
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

  if (!id || !name || !brand) {
    throw new Error("Popuni obavezno: id, naziv, brend.");
  }

  if (!editor.variants.length) {
    throw new Error("Dodaj bar jednu varijantu.");
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

  return {
    id,
    name,
    brand,
    image_url: editor.image_url.trim() || null,
    description: editor.description.trim() || null,
    gender: editor.gender,
    concentration: editor.concentration,
    on_sale: editor.on_sale,
    rating,
    votes,
    variants: normalizedVariants,
  };
}