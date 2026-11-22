import { NextResponse } from "next/server";
import { CATALOG_REVALIDATE_SECONDS, getCatalogList } from "@/db/queries/perfumes";

/**
 * Public catalog (without descriptions) for the shop, header search, quiz and wishlist.
 * Statically generated and refreshed every 5 min or right after an admin save;
 * CDN and browser cache it, so visits never reach the database.
 */
export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  const products = await getCatalogList();

  return NextResponse.json(
    { products },
    {
      headers: {
        "Cache-Control": `public, max-age=60, s-maxage=${CATALOG_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    }
  );
}
