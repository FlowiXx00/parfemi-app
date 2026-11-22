import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import { revalidateCatalog } from "@/db/queries/perfumes";
import { addStock, setStock, stopTrackingStock } from "@/db/queries/stock";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

/**
 * Perfume stock (ml left in the bottle).
 * Body: { id, mode: "set" | "add" | "off", ml? }
 * - set: exactly this many ml left in the bottle
 * - add: top up (+ml, e.g. a new bottle); atomic, so it doesn't overwrite orders placed meanwhile
 * - off: stop tracking stock (falls back to the manual "in stock" flag)
 */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-perfumes-stock", limit: 60, windowMs: 60_000 });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  const body = (await req.json().catch(() => null)) as { id?: unknown; mode?: unknown; ml?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const mode = body?.mode;
  const ml = Number(body?.ml);

  if (!id) return NextResponse.json({ error: "Nedostaje ID parfema." }, { status: 400 });

  let stockMl: number | null = null;

  if (mode === "off") {
    const { error } = await stopTrackingStock(supabaseAdmin, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (mode === "set") {
    if (!Number.isInteger(ml) || ml < 0 || ml > 100_000) {
      return NextResponse.json({ error: "Upiši koliko ml je ostalo (ceo broj, 0 ili više)." }, { status: 400 });
    }
    const { error } = await setStock(supabaseAdmin, id, ml);
    if (error) {
      const missing = error.code === "23503";
      return NextResponse.json({ error: missing ? "Parfem nije pronađen." : error.message }, { status: missing ? 404 : 500 });
    }
    stockMl = ml;
  } else if (mode === "add") {
    if (!Number.isInteger(ml) || ml === 0 || Math.abs(ml) > 100_000) {
      return NextResponse.json({ error: "Upiši koliko ml dodaješ (npr. 100)." }, { status: 400 });
    }
    const result = await addStock(supabaseAdmin, id, ml);
    if (result.error) {
      const missing = result.error.code === "23503";
      return NextResponse.json({ error: missing ? "Parfem nije pronađen." : result.error.message }, { status: missing ? 404 : 500 });
    }
    stockMl = result.stockMl;
  } else {
    return NextResponse.json({ error: "Nepoznata radnja." }, { status: 400 });
  }

  // The shop shows (un)available volumes right away.
  revalidateCatalog();
  return NextResponse.json({ ok: true, stockMl });
}
