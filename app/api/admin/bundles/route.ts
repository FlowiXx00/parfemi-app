export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import { deleteBundle, listBundlesAdmin, upsertBundle } from "@/db/queries/bundles";
import { revalidateCatalog } from "@/db/queries/perfumes";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { validateBundle } from "@/features/bundles/lib/validate-bundle";

export async function GET() {
  const auth = await requireAdminFromCookies({ allowDemo: true });
  if (auth.ok === false) return auth.response;

  const { data, error } = await listBundlesAdmin(supabaseAdmin);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bundles: data ?? [] });
}

/** Body: { bundle: {...}, originalId?: string }. originalId is sent when the ID changes (rename). */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-bundles-save", limit: 60, windowMs: 60_000 });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  const body = (await req.json().catch(() => null)) as { bundle?: unknown; originalId?: unknown } | null;
  const input = body?.bundle && typeof body.bundle === "object" ? (body.bundle as Record<string, unknown>) : null;
  if (!input) return NextResponse.json({ error: "Nedostaju podaci paketa." }, { status: 400 });

  let row;
  try {
    row = validateBundle(input);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const { error } = await upsertBundle(supabaseAdmin, row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ID was renamed -> delete the old row.
  const originalId = typeof body?.originalId === "string" ? body.originalId : "";
  if (originalId && originalId !== row.id) await deleteBundle(supabaseAdmin, originalId);

  revalidateCatalog(); // bundles are cached together with the catalog
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-bundles-delete", limit: 30, windowMs: 60_000 });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "Nedostaje ID paketa." }, { status: 400 });

  const { data, error } = await deleteBundle(supabaseAdmin, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Paket nije pronađen." }, { status: 404 });

  revalidateCatalog();
  return NextResponse.json({ ok: true });
}
