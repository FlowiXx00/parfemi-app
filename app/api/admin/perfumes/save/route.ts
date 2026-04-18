import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

type Gender = "Muški" | "Ženski" | "Unisex";
type Concentration =
  | "Eau de cologne"
  | "Eau de toilette"
  | "Eau de parfum"
  | "Extrait de parfum"
  | "Parfum";

type VariantInput = {
  ml: number;
  price_rsd: number;
  in_stock: boolean;
};

type PerfumeSavePayload = {
  id?: unknown;
  name?: unknown;
  brand?: unknown;
  image_url?: unknown;
  description?: unknown;
  gender?: unknown;
  concentration?: unknown;
  on_sale?: unknown;
  rating?: unknown;
  votes?: unknown;
  variants?: unknown;
};

const PERFUME_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DESCRIPTION_LENGTH = 12_000;

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeGender(value: unknown): Gender {
  if (value === "Muški" || value === "Ženski" || value === "Unisex") {
    return value;
  }
  return "Unisex";
}

function normalizeConcentration(value: unknown): Concentration {
  if (
    value === "Eau de cologne" ||
    value === "Eau de toilette" ||
    value === "Eau de parfum" ||
    value === "Extrait de parfum" ||
    value === "Parfum"
  ) {
    return value;
  }
  return "Eau de parfum";
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null
  );
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
    limit: 25,
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
    const name = toTrimmedString(body.name);
    const brand = toTrimmedString(body.brand);
    const image_url = toTrimmedString(body.image_url);
    const description = toTrimmedString(body.description);
    const gender = normalizeGender(body.gender);
    const concentration = normalizeConcentration(body.concentration);
    const on_sale = Boolean(body.on_sale);
    const rating = toNullableNumber(body.rating);
    const votes = toNullableNumber(body.votes);
    const normalizedVariants = normalizeVariants(body.variants);

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

    if (image_url.length > 2048) {
      return NextResponse.json(
        { error: "URL slike je predugačak." },
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

    const { error: perfumeError } = await supabaseAdmin
      .from("perfumes")
      .upsert(
        {
          id,
          name,
          brand,
          image_url: image_url || null,
          description: description || null,
          gender,
          concentration,
          on_sale,
          rating,
          votes,
        },
        { onConflict: "id" }
      );

    if (perfumeError) {
      console.error("ADMIN PERFUME UPSERT ERROR:", perfumeError);
      return NextResponse.json(
        { error: perfumeError.message },
        { status: 500 }
      );
    }

    const { error: deleteVariantsError } = await supabaseAdmin
      .from("perfume_variants")
      .delete()
      .eq("perfume_id", id);

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

    const { error: insertVariantsError } = await supabaseAdmin
      .from("perfume_variants")
      .insert(variantRows);

    if (insertVariantsError) {
      console.error("INSERT VARIANTS ERROR:", insertVariantsError);
      return NextResponse.json(
        { error: insertVariantsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id,
    });
  } catch (error) {
    console.error("POST /api/admin/parfumes/save error:", error);
    return NextResponse.json(
      { error: "Greška pri čuvanju parfema." },
      { status: 500 }
    );
  }
}