import { NextRequest, NextResponse } from "next/server";
import { revalidateCatalog } from "@/db/queries/perfumes";
import { revalidateAllReviews } from "@/db/queries/reviews";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { protectMutationRoute } from "@/lib/request-security";

/**
 * Revalidates the catalog cache right away (shop, product pages, search, sitemap) and customer reviews.
 * Needed when data is changed outside the admin (e.g. directly in Supabase).
 */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "admin-revalidate",
    limit: 10,
    windowMs: 60_000,
  });

  if (protection) {
    return protection;
  }

  const auth = await requireAdminFromCookies();

  if (auth.ok === false) {
    return auth.response;
  }

  revalidateCatalog();
  revalidateAllReviews();

  return NextResponse.json({ ok: true });
}
