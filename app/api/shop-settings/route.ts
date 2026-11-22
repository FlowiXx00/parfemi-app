import { NextResponse } from "next/server";
import { getShopSettings } from "@/db/queries/settings";

/** Public shop settings (shipping) for the cart page and cart drawer. */
export async function GET() {
  const settings = await getShopSettings();
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" },
  });
}
