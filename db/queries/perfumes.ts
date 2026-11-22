/**
 * Tables: perfumes, perfume_variants
 *
 * The public catalog (getProducts / getProductById / getCatalogList) is CACHED on the server:
 * the database is queried at most once per CATALOG_REVALIDATE_SECONDS, no matter how many
 * visitors the site has. Admin saves/deletes invalidate the cache right away (revalidateCatalog).
 */
import { revalidateTag, unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/db/clients/admin";
import { publicClient } from "@/db/clients/public";
import { readStockMap, variantAvailable, type StockMap } from "@/db/queries/stock";
import type { Db } from "@/db/types";
import { normalizeImages } from "@/features/shop/lib/product-images";
import { stripBrandPrefix } from "@/features/shop/lib/product-name";
import {
  normalizeAccords,
  normalizeNotes,
  normalizeWear,
  type Accord,
  type Notes,
  type Wear,
} from "@/features/shop/lib/scent";
import {
  normalizeConcentration,
  normalizeGender,
  normalizeHexColor,
  type ShopProduct,
  type Product,
  type ProductImage,
  type Variant,
} from "@/features/shop/types";

const CATALOG_TAG = "catalog";
export const CATALOG_REVALIDATE_SECONDS = 300;

/* -------------------------------------------------------------------------- */
/*  SELECT stringovi                                                          */
/* -------------------------------------------------------------------------- */

/** All perfume data + variants (catalog and admin list). */
const PERFUME_FULL_SELECT = `
  id,
  name,
  brand,
  description,
  gender,
  concentration,
  on_sale,
  rating,
  votes,
  images,
  liquid_color,
  accords,
  notes,
  wear,
  is_featured,
  variants:perfume_variants (
    ml,
    price_rsd,
    in_stock
  )
`;

/** Basics + variants only (price check at checkout). */
const PERFUME_BASIC_SELECT = `
  id,
  name,
  brand,
  is_active,
  variants:perfume_variants (
    ml,
    price_rsd,
    in_stock
  )
`;

/* -------------------------------------------------------------------------- */
/* Public catalog (anon client, cached, mapped to Product) */
/* -------------------------------------------------------------------------- */

type CatalogVariantRow = {
  ml: number | string | null;
  price_rsd: number | string | null;
  in_stock: boolean | null;
};

type CatalogProductRow = {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  gender: unknown;
  concentration: unknown;
  on_sale: boolean | null;
  rating: number | null;
  votes: number | null;
  images: unknown;
  liquid_color: string | null;
  accords: unknown;
  notes: unknown;
  wear: unknown;
  is_featured: boolean | null;
  variants: CatalogVariantRow[] | null;
};

/** How many perfumes get the "Best seller" badge, and from how many units sold. */
const BESTSELLER_COUNT = 6;
const BESTSELLER_MIN_SOLD = 2;
const SALES_WINDOW_DAYS = 90;

type SalesInfo = { rank: number; bestseller: boolean };

/**
 * Sales rank from orders (server-side, service_role). The site only receives
 * the rank and the "Best seller" flag, never sales numbers.
 */
async function fetchSalesRanking(): Promise<Map<string, SalesInfo>> {
  const ranking = new Map<string, SalesInfo>();

  const { data, error } = await supabaseAdmin.rpc("perfume_sales_ranking", {
    days: SALES_WINDOW_DAYS,
  });

  if (error) {
    console.error("Rang prodaje nije učitan:", error.message);
    return ranking;
  }

  ((data ?? []) as { perfume_id: string; sold: number }[]).forEach((row, index) => {
    ranking.set(row.perfume_id, {
      rank: index + 1,
      bestseller: index < BESTSELLER_COUNT && Number(row.sold) >= BESTSELLER_MIN_SOLD,
    });
  });

  return ranking;
}

function mapVariant(variant: CatalogVariantRow, stockMl: number | undefined): Variant {
  const ml = Number(variant.ml ?? 0);
  return {
    ml,
    priceRsd: Number(variant.price_rsd ?? 0),
    // Manual "in stock" + (when stock is tracked) enough ml in the bottle for this volume.
    inStock: variantAvailable(Boolean(variant.in_stock), ml, stockMl),
  };
}

function mapRow(product: CatalogProductRow, sales?: Map<string, SalesInfo>, stock?: StockMap): Product {
  const salesInfo = sales?.get(product.id);
  const stockMl = stock?.get(product.id);
  return {
    id: product.id,
    name: stripBrandPrefix(product.brand, product.name),
    brand: product.brand,
    description: product.description ?? null,
    gender: normalizeGender(product.gender),
    concentration: normalizeConcentration(product.concentration),
    onSale: Boolean(product.on_sale),
    rating: product.rating ?? null,
    votes: product.votes ?? null,
    images: normalizeImages(product.images),
    liquidColor: normalizeHexColor(product.liquid_color),
    accords: normalizeAccords(product.accords),
    notes: normalizeNotes(product.notes),
    wear: normalizeWear(product.wear),
    isFeatured: Boolean(product.is_featured),
    isBestseller: salesInfo?.bestseller ?? false,
    salesRank: salesInfo?.rank ?? null,
    variants: (product.variants ?? []).map((variant) => mapVariant(variant, stockMl)),
  };
}

/**
 * Supabase (PostgREST) returns at most 1000 rows per query, so the large catalog
 * is read in pages. `buildPage(from, to)` must have a stable order (ending with `id`).
 */
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

async function fetchAllProducts(): Promise<Product[]> {
  const [{ data, error }, sales, stock] = await Promise.all([
    fetchAllPages<CatalogProductRow>((from, to) =>
      publicClient
        .from("perfumes")
        .select(PERFUME_FULL_SELECT)
        // Hidden perfumes (admin "Hide from shop") aren't shown; RLS hides them as well.
        .eq("is_active", true)
        // Perfumes with Fragrantica ratings first; unrated ones (null) go last, not first.
        .order("votes", { ascending: false, nullsFirst: false })
        .order("rating", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .order("ml", { referencedTable: "perfume_variants", ascending: true })
        .range(from, to)
    ),
    fetchSalesRanking(),
    // Stock (ml in the bottle) is visible to the server only.
    readStockMap(supabaseAdmin),
  ]);

  if (error) throw new Error(error.message);
  // A perfume without prices (variants) isn't shown in the shop until the admin adds them.
  return data.map((row) => mapRow(row, sales, stock)).filter((product) => product.variants.length > 0);
}

const cacheOptions = {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_REVALIDATE_SECONDS,
};

/** Full catalog with descriptions (shop page, sitemap). */
export const getProducts = unstable_cache(
  fetchAllProducts,
  ["catalog:products"],
  cacheOptions
);

/** Catalog without descriptions (/api/catalog): shop, header search, quiz and wishlist. */
export const getCatalogList = unstable_cache(
  async (): Promise<ShopProduct[]> =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (await fetchAllProducts()).map(({ description, ...rest }) => rest),
  ["catalog:list"],
  cacheOptions
);

export const getProductById = unstable_cache(
  async (id: string): Promise<Product | null> => {
    const [{ data, error }, sales, stock] = await Promise.all([
      publicClient
        .from("perfumes")
        .select(PERFUME_FULL_SELECT)
        .eq("id", id)
        .eq("is_active", true)
        .order("ml", { referencedTable: "perfume_variants", ascending: true })
        .maybeSingle(),
      fetchSalesRanking(),
      readStockMap(supabaseAdmin, [id]),
    ]);

    if (error || !data) return null;
    const product = mapRow(data as unknown as CatalogProductRow, sales, stock);
    return product.variants.length > 0 ? product : null;
  },
  ["catalog:product"],
  cacheOptions
);

/** Called after every perfume change so the site shows the new data right away. */
export function revalidateCatalog() {
  revalidateTag(CATALOG_TAG, { expire: 0 });
}

/* -------------------------------------------------------------------------- */
/* Reads (return the raw { data, error }) */
/* -------------------------------------------------------------------------- */

/** Admin list: all perfumes with variants (no cache, always fresh). */
/** The admin also sees cost/margin (perfume_costs, service_role only, never customers). */
const PERFUME_ADMIN_SELECT = `${PERFUME_FULL_SELECT},
  is_active,
  stock:perfume_stock (stock_ml),
  costs:perfume_costs (bottle_price_rsd, bottle_ml, margin_pct, packaging_rsd, round_step)`;

export async function listPerfumesAdmin(db: Db) {
  return await fetchAllPages<Record<string, unknown>>((from, to) =>
    db
      .from("perfumes")
      .select(PERFUME_ADMIN_SELECT)
      .order("brand", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

/** Perfumes by a list of IDs (price check at checkout, always fresh). */
export async function listPerfumesByIds(db: Db, ids: string[]) {
  return await db.from("perfumes").select(PERFUME_BASIC_SELECT).in("id", ids);
}


/* -------------------------------------------------------------------------- */
/*  Pisanje (admin)                                                           */
/* -------------------------------------------------------------------------- */

export type PerfumeUpsertRow = {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  gender: string;
  concentration: string;
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
};

/** Show/hide a perfume in the shop (it stays in the database). Returns the id if the perfume exists. */
export async function setPerfumeActive(db: Db, id: string, active: boolean) {
  return await db.from("perfumes").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
}

/** Fragrantica rating and vote count (quick rating entry). null = clear the rating. */
export async function setPerfumeRating(db: Db, id: string, rating: number | null, votes: number | null) {
  return await db.from("perfumes").update({ rating, votes }).eq("id", id).select("id").maybeSingle();
}

export type PerfumeVariantInsertRow = {
  perfume_id: string;
  ml: number;
  price_rsd: number;
  in_stock: boolean;
};

export async function upsertPerfume(db: Db, row: PerfumeUpsertRow) {
  return await db.from("perfumes").upsert(row, { onConflict: "id" });
}

export type PerfumeCostsRow = {
  perfume_id: string;
  bottle_price_rsd: number | null;
  bottle_ml: number | null;
  margin_pct: number | null;
  packaging_rsd: number;
  round_step: number;
};

/** Cost and margin (admin price calculator). The table is accessible to the service_role key only. */
export async function upsertPerfumeCosts(db: Db, row: PerfumeCostsRow) {
  return await db
    .from("perfume_costs")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "perfume_id" });
}

export async function deleteVariantsByPerfumeId(db: Db, perfumeId: string) {
  return await db.from("perfume_variants").delete().eq("perfume_id", perfumeId);
}

export async function insertVariants(db: Db, rows: PerfumeVariantInsertRow[]) {
  return await db.from("perfume_variants").insert(rows);
}

export async function deletePerfumeById(db: Db, id: string) {
  return await db
    .from("perfumes")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
}
