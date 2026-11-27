export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { toCsv } from "@/lib/csv";

type ContactRow = { email: string | null; full_name: string | null; marketing_opt_in_at: string | null };

/**
 * Customers who agreed to news and offers (settings page).
 * GET → { count } (the demo account may see it); GET ?format=csv → file for an email tool (admin only).
 */
export async function GET(req: NextRequest) {
  const wantsCsv = req.nextUrl.searchParams.get("format") === "csv";

  try {
    const auth = await requireAdminFromCookies({ allowDemo: !wantsCsv });
    if (auth.ok === false) return auth.response;

    if (!wantsCsv) {
      const { count, error } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("marketing_opt_in", true);
      if (error) {
        // Before migration 017 the column doesn't exist yet.
        if (error.code === "42703") return NextResponse.json({ count: 0, available: false });
        console.error("MARKETING COUNT ERROR:", error);
        return NextResponse.json({ error: "Broj pretplatnika nije učitan." }, { status: 500 });
      }
      return NextResponse.json({ count: count ?? 0, available: true });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, marketing_opt_in_at")
      .eq("marketing_opt_in", true)
      .order("marketing_opt_in_at", { ascending: false })
      .limit(10_000);

    if (error) {
      console.error("MARKETING EXPORT ERROR:", error);
      return NextResponse.json({ error: "Spisak nije napravljen." }, { status: 500 });
    }

    const rows = ((data ?? []) as ContactRow[])
      .filter((row) => row.email)
      .map((row) => [row.email ?? "", row.full_name ?? "", row.marketing_opt_in_at ?? ""]);
    const csv = toCsv([["email", "ime", "saglasnost_od"], ...rows]);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pretplatnici-${date}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/marketing-contacts error:", error);
    return NextResponse.json({ error: "Spisak nije učitan." }, { status: 500 });
  }
}
