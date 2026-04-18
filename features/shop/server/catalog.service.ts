import { createClient } from "@supabase/supabase-js";
import type { Concentration, Gender, Product, Variant } from "../types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase catalog env vars are missing.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FALLBACK_IMG = "https://placehold.co/600x600?text=No+Image";

const SELECT_WITH_VARIANTS = `
  id,
  name,
  brand,
  image_url,
  description,
  gender,
  concentration,
  on_sale,
  rating,
  votes,
  variants:perfume_variants (
    ml,
    price_rsd,
    in_stock
  )
`;

type CatalogVariantRow = {
  ml: number | string | null;
  price_rsd: number | string | null;
  in_stock: boolean | null;
};

type CatalogProductRow = {
  id: string;
  name: string;
  brand: string;
  image_url: string | null;
  description: string | null;
  gender: Gender;
  concentration: Concentration;
  on_sale: boolean | null;
  rating: number | null;
  votes: number | null;
  variants: CatalogVariantRow[] | null;
};

function mapVariant(variant: CatalogVariantRow): Variant {
  return {
    ml: Number(variant.ml ?? 0),
    priceRsd: Number(variant.price_rsd ?? 0),
    inStock: Boolean(variant.in_stock),
  };
}

function mapRow(product: CatalogProductRow): Product {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    imageUrl: product.image_url ?? FALLBACK_IMG,
    description: product.description ?? null,
    gender: product.gender,
    concentration: product.concentration,
    onSale: Boolean(product.on_sale),
    rating: product.rating ?? null,
    votes: product.votes ?? null,
    variants: (product.variants ?? []).map(mapVariant),
  };
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("perfumes")
    .select(SELECT_WITH_VARIANTS)
    .order("votes", { ascending: false })
    .order("rating", { ascending: false })
    .order("ml", { referencedTable: "perfume_variants", ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as CatalogProductRow[]).map(mapRow);
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("perfumes")
    .select(SELECT_WITH_VARIANTS)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapRow(data as CatalogProductRow);
}
