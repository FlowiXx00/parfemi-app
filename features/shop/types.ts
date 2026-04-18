export type Variant = { ml: number; priceRsd: number; inStock: boolean };

export type Gender = "Muški" | "Ženski" | "Unisex";

export type Concentration =
  | "Eau de cologne"
  | "Eau de toilette"
  | "Eau de parfum"
  | "Extrait de parfum"
  | "Parfum";

export type NoteTier = "top" | "middle" | "base";
export type Note = { tier: NoteTier; name: string; imageUrl: string };

export type Product = {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  description?: string | null;
  gender: Gender;
  concentration: Concentration;
  onSale: boolean;
  rating?: number | null;
  votes?: number | null;
  variants: Variant[];
};