import type {
  Concentration,
  Gender,
  ProductImage,
} from "@/features/shop/types";
import type { Accord, Notes, Wear, WearKey } from "@/features/shop/lib/scent";

export type { Accord, Notes, Wear, WearKey };

/** Accord in the form (strength can be empty while typing). */
export type AccordRow = { name: string; strength: number };

export {
  CONCENTRATIONS,
  GENDERS,
  type Concentration,
  type Gender,
} from "@/features/shop/types";

/** Image row in the admin form (url can be empty while typing). */
export type ImageRow = ProductImage;

export type VariantRow = {
  ml: number | "";
  price_rsd: number | "";
  in_stock: boolean;
};

/** Cost and margin (perfume_costs table, admin only). */
export type PerfumeCosts = {
  bottle_price_rsd: number | null;
  bottle_ml: number | null;
  margin_pct: number | null;
  packaging_rsd: number;
  round_step: number;
};

export const ROUND_STEPS = [1, 10, 50, 100] as const;

export type PerfumeAdminRow = {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  gender: Gender;
  concentration: Concentration;
  on_sale: boolean;
  rating: number | null;
  votes: number | null;
  images: ImageRow[];
  liquid_color: string | null;
  is_featured: boolean;
  /** false = hidden from the shop (stays in the database) */
  is_active: boolean;
  /** ml left in the bottle; null = stock not tracked */
  stock_ml: number | null;
  accords: Accord[];
  notes: Notes;
  wear: Wear;
  costs: PerfumeCosts | null;
  variants: VariantRow[];
};

export type EditorState = {
  id: string;
  name: string;
  brand: string;
  description: string;
  gender: Gender;
  concentration: Concentration;
  on_sale: boolean;
  rating: number | "";
  votes: number | "";
  images: ImageRow[];
  /** "" = automatic, from the image */
  liquid_color: string;
  is_featured: boolean;
  is_active: boolean;
  /** Notes as comma-separated text (easier to type): "bergamot, limun" */
  notesTop: string;
  notesMiddle: string;
  notesBase: string;
  accords: AccordRow[];
  /** 0–100 per season and day/night */
  wear: Record<WearKey, number>;
  /** Price calculator: what the whole bottle cost, its size in ml, margin in % */
  bottlePrice: number | "";
  bottleMl: number | "";
  marginPct: number | "";
  /** vial/packaging cost per decant */
  packaging: number | "";
  roundStep: number;
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
  description: string | null;
  gender: Gender;
  concentration: Concentration;
  on_sale: boolean;
  rating: number | null;
  votes: number | null;
  images: ProductImage[];
  liquid_color: string | null;
  is_featured: boolean;
  is_active: boolean;
  accords: Accord[];
  notes: Notes;
  wear: Wear;
  costs: PerfumeCosts;
  variants: SaveVariantPayload[];
};
