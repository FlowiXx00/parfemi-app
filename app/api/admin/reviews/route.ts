export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { getProducts } from "@/db/queries/perfumes";
import {
  deleteReviewById,
  listReviewsAdmin,
  revalidateProductReviews,
  type AdminReviewRow,
} from "@/db/queries/reviews";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import type { AdminReview } from "@/features/admin/reviews/types";
import { mapReviewRow } from "@/features/reviews/lib/reviews";
import { protectMutationRoute } from "@/lib/request-security";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Newest customer reviews with the perfume name (the demo account may read them). */
export async function GET() {
  try {
    const auth = await requireAdminFromCookies({ allowDemo: true });
    if (auth.ok === false) return auth.response;

    const [{ data, error }, products] = await Promise.all([
      listReviewsAdmin(supabaseAdmin),
      getProducts().catch(() => []),
    ]);

    if (error) {
      console.error("ADMIN REVIEWS LIST ERROR:", error);
      return NextResponse.json({ error: "Recenzije nisu učitane." }, { status: 500 });
    }

    // Names from the cached catalog; a hidden or deleted perfume shows its ID.
    const names = new Map(products.map((product) => [product.id, { name: product.name, brand: product.brand }]));
    const reviews: AdminReview[] = ((data ?? []) as AdminReviewRow[]).map((row) => ({
      ...mapReviewRow(row),
      productId: row.product_id,
      perfumeName: names.get(row.product_id)?.name ?? row.product_id,
      perfumeBrand: names.get(row.product_id)?.brand ?? "",
      perfumeVisible: names.has(row.product_id),
    }));

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("GET /api/admin/reviews error:", error);
    return NextResponse.json({ error: "Recenzije nisu učitane." }, { status: 500 });
  }
}

/** Removes a review (?id=), e.g. an offensive one or one that isn't about the perfume. */
export async function DELETE(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-reviews-delete", limit: 30, windowMs: 60_000 });
  if (protection) return protection;

  try {
    const auth = await requireAdminFromCookies();
    if (auth.ok === false) return auth.response;

    const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Neispravan ID recenzije." }, { status: 400 });
    }

    const { data, error } = await deleteReviewById(supabaseAdmin, id);
    if (error) {
      console.error("ADMIN REVIEW DELETE ERROR:", error);
      return NextResponse.json({ error: "Brisanje nije uspelo." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Recenzija nije pronađena." }, { status: 404 });
    }

    revalidateProductReviews(data.product_id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/reviews error:", error);
    return NextResponse.json({ error: "Brisanje nije uspelo." }, { status: 500 });
  }
}
