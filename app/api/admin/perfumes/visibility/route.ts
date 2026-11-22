import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import { revalidateCatalog, setPerfumeActive } from "@/db/queries/perfumes";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

/**
 * Show or hide a perfume in the shop without deleting it (prices, images and notes are kept).
 * Body: { id: string, active: boolean }
 */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "admin-perfumes-visibility",
    limit: 60,
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

    const body = (await req.json().catch(() => null)) as { id?: unknown; active?: unknown } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";

    if (!id || typeof body?.active !== "boolean") {
      return NextResponse.json({ error: "Potrebni su id i active (true/false)." }, { status: 400 });
    }

    const { data, error } = await setPerfumeActive(supabaseAdmin, id, body.active);

    if (error) {
      console.error("PERFUME VISIBILITY ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Parfem nije pronađen." }, { status: 404 });
    }

    // Shop, product page, search and sitemap see the change right away.
    revalidateCatalog();

    return NextResponse.json({ ok: true, id, active: body.active });
  } catch (error) {
    console.error("POST /api/admin/perfumes/visibility error:", error);
    return NextResponse.json({ error: "Greška pri promeni vidljivosti." }, { status: 500 });
  }
}
