import { NextResponse } from "next/server";
import { CATALOG_REVALIDATE_SECONDS, getProductById } from "@/db/queries/perfumes";
import type { ProductDetails } from "@/features/shop/types";

/**
 * What the light catalog leaves out for one perfume (the quick view's notes). Served from the cached
 * catalog and cached by the CDN, so opening a quick view never reaches the database.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 200) {
    return NextResponse.json({ error: "Nedostaje parfem." }, { status: 400 });
  }

  const product = await getProductById(id);
  if (!product) {
    return NextResponse.json({ error: "Parfem nije pronađen." }, { status: 404 });
  }

  const details: ProductDetails = { notes: product.notes };
  return NextResponse.json(details, {
    headers: {
      "Cache-Control": `public, max-age=60, s-maxage=${CATALOG_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
