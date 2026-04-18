export const GENDERS = ["Muški", "Ženski", "Unisex"] as const;
export type Gender = (typeof GENDERS)[number];

export const CONCENTRATIONS = [
  "Eau de cologne",
  "Eau de toilette",
  "Eau de parfum",
  "Extrait de parfum",
  "Parfum",
] as const;
export type Concentration = (typeof CONCENTRATIONS)[number];

export type VariantRow = {
  ml: number | "";
  price_rsd: number | "";
  in_stock: boolean;
};

export type PerfumeAdminRow = {
  id: string;
  name: string;
  brand: string;
  image_url: string | null;
  description: string | null;
  gender: Gender;
  concentration: Concentration;
  on_sale: boolean;
  rating: number | null;
  votes: number | null;
  variants: VariantRow[];
};

export type EditorState = {
  id: string;
  name: string;
  brand: string;
  image_url: string;
  description: string;
  gender: Gender;
  concentration: Concentration;
  on_sale: boolean;
  rating: number | "";
  votes: number | "";
  variants: VariantRow[];
};

export type SaveVariantPayload = {
  ml: number;
  price_rsd: number;
  in_stock: boolean;
};

export type SavePerfumePayload = {
  id: string;
  name: string;
  brand: string;
  image_url: string | null;
  description: string | null;
  gender: Gender;
  concentration: Concentration;
  on_sale: boolean;
  rating: number | null;
  votes: number | null;
  variants: SaveVariantPayload[];
};