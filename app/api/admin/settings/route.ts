export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import { readShopSettingsFresh, revalidateShopSettings, updateShopSettings } from "@/db/queries/settings";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

export async function GET() {
  const auth = await requireAdminFromCookies({ allowDemo: true });
  if (auth.ok === false) return auth.response;
  return NextResponse.json(await readShopSettingsFresh(supabaseAdmin));
}

/** Body: { shippingRsd: number, freeShippingFromRsd: number | null } */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-settings", limit: 30, windowMs: 60_000 });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  const body = (await req.json().catch(() => null)) as { shippingRsd?: unknown; freeShippingFromRsd?: unknown } | null;
  const shippingRsd = Number(body?.shippingRsd);
  const freeRaw = body?.freeShippingFromRsd;
  const freeShippingFromRsd = freeRaw === null || freeRaw === "" || freeRaw === undefined ? null : Number(freeRaw);

  if (!Number.isInteger(shippingRsd) || shippingRsd < 0 || shippingRsd > 100_000) {
    return NextResponse.json({ error: "Cena dostave mora biti ceo broj od 0 naviše." }, { status: 400 });
  }
  if (freeShippingFromRsd !== null && (!Number.isInteger(freeShippingFromRsd) || freeShippingFromRsd <= 0)) {
    return NextResponse.json({ error: "Prag za besplatnu dostavu mora biti ceo broj veći od 0 (ili prazno)." }, { status: 400 });
  }

  const { error } = await updateShopSettings(supabaseAdmin, { shippingRsd, freeShippingFromRsd });
  if (error) {
    console.error("ADMIN SETTINGS ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cart, the Shipping page and the shopping assistant see the new price right away.
  revalidateShopSettings();
  return NextResponse.json({ ok: true, shippingRsd, freeShippingFromRsd });
}
