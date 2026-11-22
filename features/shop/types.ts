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

import type { Accord, Notes, Wear } from "@/features/shop/lib/scent";

export type Variant = { ml: number; priceRsd: number; inStock: boolean };

/** Perfume image: URL (https://... or a /path in public/) + label. The first one is the main image. */
export type ProductImage = { url: string; label: string };

export type Product = {
  id: string;
  name: string;
  brand: string;
  description?: string | null;
  gender: Gender;
  concentration: Concentration;
  onSale: boolean;
  rating?: number | null;
  votes?: number | null;
  images: ProductImage[];
  /** Liquid color (#rrggbb) entered by the admin; null = estimate from the image. */
  liquidColor: string | null;
  /** Accords, strongest first. */
  accords: Accord[];
  notes: Notes;
  /** When to wear (0–100 per season and day/night). */
  wear: Wear;
  /** "Featured": highlighted by the admin. */
  isFeatured: boolean;
  /** "Best seller": among the top sellers in the last 90 days. */
  isBestseller: boolean;
  /** Sales rank (1 = best seller), null = no sales. Sales numbers themselves are never sent. */
  salesRank: number | null;
  variants: Variant[];
};

/** Lighter product shape for lists and search (no description or notes). */
export type CatalogProduct = Omit<Product, "description" | "notes">;

/** Perfume in the shop and /api/catalog: everything except the description (the quick view needs notes). */
export type ShopProduct = Omit<Product, "description">;

export function normalizeGender(value: unknown): Gender {
  return GENDERS.includes(value as Gender) ? (value as Gender) : "Unisex";
}

/** "#AbC123" -> "#abc123"; sve ostalo -> null. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

export function normalizeConcentration(value: unknown): Concentration {
  return CONCENTRATIONS.includes(value as Concentration)
    ? (value as Concentration)
    : "Eau de parfum";
}
