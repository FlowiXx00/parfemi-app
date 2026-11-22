import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import { revalidateCatalog, setPerfumeRating } from "@/db/queries/perfumes";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

/**
 * Quick Fragrantica rating entry: changes ONLY the rating and vote count.
 * Body: { id: string, rating: number | null, votes: number | null }
 */
export async function POST(req: NextRequest) {
  // Quick entry sends one rating every few seconds, so the limit is higher than for a regular save.
  const protection = protectMutationRoute(req, {
    key: "admin-perfumes-rating",
    limit: 120,
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

    const body = (await req.json().catch(() => null)) as {
      id?: unknown;
      rating?: unknown;
      votes?: unknown;
    } | null;

    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const rating = body?.rating === null ? null : Number(body?.rating);
    const votes = body?.votes === null ? null : Number(body?.votes);

    if (!id) {
      return NextResponse.json({ error: "Nedostaje ID parfema." }, { status: 400 });
    }

    if (rating !== null && !(Number.isFinite(rating) && rating >= 1 && rating <= 5)) {
      return NextResponse.json({ error: "Ocena mora biti između 1 i 5." }, { status: 400 });
    }

    if (votes !== null && !(Number.isInteger(votes) && votes >= 0 && votes < 10_000_000)) {
      return NextResponse.json({ error: "Broj glasova nije ispravan." }, { status: 400 });
    }

    const { data, error } = await setPerfumeRating(
      supabaseAdmin,
      id,
      rating === null ? null : Math.round(rating * 100) / 100,
      votes
    );

    if (error) {
      console.error("PERFUME RATING ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Parfem nije pronađen." }, { status: 404 });
    }

    revalidateCatalog();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/perfumes/rating error:", error);
    return NextResponse.json({ error: "Greška pri čuvanju ocene." }, { status: 500 });
  }
}
