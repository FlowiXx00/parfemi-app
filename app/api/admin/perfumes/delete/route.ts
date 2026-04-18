import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

export async function DELETE(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "admin-perfumes-delete",
    limit: 25,
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

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { error: "ID parfema je obavezan." },
        { status: 400 }
      );
    }

    const { error: deleteVariantsError } = await supabaseAdmin
      .from("perfume_variants")
      .delete()
      .eq("perfume_id", id);

    if (deleteVariantsError) {
      console.error("DELETE VARIANTS ERROR:", deleteVariantsError);
      return NextResponse.json(
        { error: deleteVariantsError.message },
        { status: 500 }
      );
    }

    const { data: deletedPerfume, error: deletePerfumeError } =
      await supabaseAdmin
        .from("perfumes")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();

    if (deletePerfumeError) {
      console.error("DELETE PERFUME ERROR:", deletePerfumeError);
      return NextResponse.json(
        { error: deletePerfumeError.message },
        { status: 500 }
      );
    }

    if (!deletedPerfume) {
      return NextResponse.json(
        { error: "Parfem nije pronađen." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/parfumes/delete error:", error);
    return NextResponse.json(
      { error: "Greška pri brisanju parfema." },
      { status: 500 }
    );
  }
}