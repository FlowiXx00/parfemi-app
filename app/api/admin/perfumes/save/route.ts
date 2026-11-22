import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import {
  deleteVariantsByPerfumeId,
  insertVariants,
  revalidateCatalog,
  upsertPerfume,
  upsertPerfumeCosts,
} from "@/db/queries/perfumes";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { storeExternalImages } from "@/features/admin/perfumes/server/mirror-images";
import { normalizeImages } from "@/features/shop/lib/product-images";
import { normalizeAccords, normalizeNotes, normalizeWear } from "@/features/shop/lib/scent";
import { stripBrandPrefix } from "@/features/shop/lib/product-name";
import {
  normalizeConcentration,
  normalizeGender,
  normalizeHexColor,
} from "@/features/shop/types";
import { cleanText as toTrimmedString } from "@/lib/validation";

type VariantInput = {
  ml: number;
  price_rsd: number;
  in_stock: boolean;
};

type PerfumeSavePayload = {
  id?: unknown;
  name?: unknown;
  brand?: unknown;
  description?: unknown;
  gender?: unknown;
  concentration?: unknown;
  on_sale?: unknown;
  rating?: unknown;
  votes?: unknown;
  images?: unknown;
  liquid_color?: unknown;
  is_featured?: unknown;
  is_active?: unknown;
  accords?: unknown;
  notes?: unknown;
  wear?: unknown;
  costs?: unknown;
  variants?: unknown;
};

const PERFUME_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 12_000;

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null
  );
}

const ROUND_STEPS = new Set([1, 10, 50, 100]);

/** Bottle cost, bottle size, margin, packaging: all optional, but never negative. */
function normalizeCosts(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const positiveInt = (v: unknown, min: number) => {
    const n = toNullableNumber(v);
    return n === null || n < min ? null : Math.round(n);
  };
  const margin = toNullableNumber(row.margin_pct);
  const step = Number(row.round_step);
  return {
    bottle_price_rsd: positiveInt(row.bottle_price_rsd, 0),
    bottle_ml: positiveInt(row.bottle_ml, 1),
    margin_pct: margin === null || margin < 0 ? null : Math.min(9999, margin),
    packaging_rsd: positiveInt(row.packaging_rsd, 0) ?? 0,
    round_step: ROUND_STEPS.has(step) ? step : 50,
  };
}

function normalizeVariants(value: unknown): VariantInput[] {
  const rows = toObjectArray(value);

  return rows
    .map((row) => ({
      ml: Number(row.ml),
      price_rsd: Number(row.price_rsd),
      in_stock: Boolean(row.in_stock),
    }))
    .filter(
      (variant): variant is VariantInput =>
        Number.isFinite(variant.ml) &&
        variant.ml > 0 &&
        Number.isFinite(variant.price_rsd) &&
        variant.price_rsd >= 0
    )
    .sort((a, b) => a.ml - b.ml);
}

export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "admin-perfumes-save",
    limit: 30,
    windowMs: 60_000,
  });

  if (protection) {
    return protection;
  }

  try {
    const auth = await requireAdminFromCookies();

    if (auth.ok === false) {
      return auth.response;
    }

    const body = (await req.json()) as PerfumeSavePayload;

    const id = toTrimmedString(body.id);
    const brand = toTrimmedString(body.brand);
    // The name is stored without the brand: "Amouage Guidance" -> "Guidance" (brand is a separate field).
    const name = stripBrandPrefix(brand, toTrimmedString(body.name));
    const description = toTrimmedString(body.description);
    const gender = normalizeGender(body.gender);
    const concentration = normalizeConcentration(body.concentration);
    const on_sale = Boolean(body.on_sale);
    const is_featured = Boolean(body.is_featured);
    // New perfumes are visible; only an explicit false hides one.
    const is_active = body.is_active !== false;
    const rating = toNullableNumber(body.rating);
    const votes = toNullableNumber(body.votes);
    const normalizedVariants = normalizeVariants(body.variants);
    // Keep only valid URLs (https:// or /path), at most 12.
    const images = normalizeImages(body.images);
    // Invalid or empty color -> null (the site estimates the color from the image).
    const liquid_color = normalizeHexColor(body.liquid_color);

    if (!id || !name || !brand) {
      return NextResponse.json(
        { error: "ID, naziv i brend su obavezni." },
        { status: 400 }
      );
    }

    if (!PERFUME_ID_RE.test(id)) {
      return NextResponse.json(
        { error: "ID parfema mora biti slug format (mala slova, brojevi i crtice)." },
        { status: 400 }
      );
    }

    if (name.length > 140 || brand.length > 140) {
      return NextResponse.json(
        { error: "Naziv i brend moraju biti kraći od 140 karaktera." },
        { status: 400 }
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: "Opis je predugačak." },
        { status: 400 }
      );
    }

    if (normalizedVariants.length > 25) {
      return NextResponse.json(
        { error: "Previše varijanti za jedan parfem." },
        { status: 400 }
      );
    }

    if (!normalizedVariants.length) {
      return NextResponse.json(
        { error: "Moraš imati bar jednu ispravnu varijantu." },
        { status: 400 }
      );
    }

    const mlSet = new Set<number>();
    for (const variant of normalizedVariants) {
      if (mlSet.has(variant.ml)) {
        return NextResponse.json(
          { error: `Dupla varijanta za ${variant.ml} ml nije dozvoljena.` },
          { status: 400 }
        );
      }
      mlSet.add(variant.ml);
    }

    // External images (fimgs.net, brand sites…) are downloaded into our Storage, so the site doesn't
    // depend on the original link still working tomorrow.
    const storedImages = await storeExternalImages(id, images);

    const { error: perfumeError } = await upsertPerfume(supabaseAdmin, {
      id,
      name,
      brand,
      description: description || null,
      gender,
      concentration,
      on_sale,
      rating,
      votes,
      images: storedImages.images,
      liquid_color,
      is_featured,
      is_active,
      accords: normalizeAccords(body.accords),
      notes: normalizeNotes(body.notes),
      wear: normalizeWear(body.wear),
    });

    if (perfumeError) {
      console.error("ADMIN PERFUME UPSERT ERROR:", perfumeError);
      return NextResponse.json(
        { error: perfumeError.message },
        { status: 500 }
      );
    }

    // Cost and margin (admin calculator only). A failure here must not break saving the perfume.
    const costs = normalizeCosts(body.costs);
    if (costs) {
      const { error: costsError } = await upsertPerfumeCosts(supabaseAdmin, { perfume_id: id, ...costs });
      if (costsError) console.error("PERFUME COSTS UPSERT ERROR:", costsError);
    }

    const { error: deleteVariantsError } = await deleteVariantsByPerfumeId(
      supabaseAdmin,
      id
    );

    if (deleteVariantsError) {
      console.error("DELETE VARIANTS ERROR:", deleteVariantsError);
      return NextResponse.json(
        { error: deleteVariantsError.message },
        { status: 500 }
      );
    }

    const variantRows = normalizedVariants.map((variant) => ({
      perfume_id: id,
      ml: variant.ml,
      price_rsd: variant.price_rsd,
      in_stock: variant.in_stock,
    }));

    const { error: insertVariantsError } = await insertVariants(
      supabaseAdmin,
      variantRows
    );

    if (insertVariantsError) {
      console.error("INSERT VARIANTS ERROR:", insertVariantsError);
      return NextResponse.json(
        { error: insertVariantsError.message },
        { status: 500 }
      );
    }

    // Shop, product page, search and sitemap see the change right away.
    revalidateCatalog();

    return NextResponse.json({
      ok: true,
      id,
      storedImages: storedImages.stored,
      warnings: storedImages.warnings,
    });
  } catch (error) {
    console.error("POST /api/admin/parfumes/save error:", error);
    return NextResponse.json(
      { error: "Greška pri čuvanju parfema." },
      { status: 500 }
    );
  }
}
