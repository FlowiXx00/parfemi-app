export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";

export async function GET() {
  try {
    const auth = await requireAdminFromCookies();

    if (auth.ok === false) {
      return auth.response;
    }

    const { data, error } = await supabaseAdmin
      .from("perfumes")
      .select(`
        id,
        name,
        brand,
        image_url,
        description,
        gender,
        concentration,
        on_sale,
        rating,
        votes,
        variants:perfume_variants (
          ml,
          price_rsd,
          in_stock
        )
      `)
      .order("votes", { ascending: false })
      .order("rating", { ascending: false });

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
