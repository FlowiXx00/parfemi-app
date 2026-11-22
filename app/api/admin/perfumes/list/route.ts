export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { listPerfumesAdmin } from "@/db/queries/perfumes";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

export async function GET() {
  try {
    const auth = await requireAdminFromCookies({ allowDemo: true });

    if (auth.ok === false) {
      return auth.response;
    }

    const { data, error } = await listPerfumesAdmin(supabaseAdmin);

    if (error) {
      console.error("ADMIN PARFUMES LIST ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      perfumes: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/admin/parfumes/list error:", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju parfema." },
      { status: 500 }
    );
  }
}
