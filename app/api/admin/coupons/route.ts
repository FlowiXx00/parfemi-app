export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import { deleteCoupon, insertCoupon, listCoupons, updateCoupon } from "@/db/queries/coupons";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { validateCouponPayload } from "@/features/admin/coupons/lib/coupon-form";
import { normalizeCouponCode } from "@/features/orders/lib/coupons";

/** List all coupons (admin). */
export async function GET() {
  const auth = await requireAdminFromCookies({ allowDemo: true });
  if (auth.ok === false) return auth.response;

  const { data, error } = await listCoupons(supabaseAdmin);
  if (error) {
    console.error("ADMIN COUPONS LIST ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ coupons: data ?? [] });
}

/**
 * Create a coupon or update an existing one.
 * Body: { originalCode?: string, coupon: {...} }. originalCode means update.
 */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-coupons-save", limit: 60, windowMs: 60_000 });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => null)) as { originalCode?: unknown; coupon?: unknown } | null;
    const input = body?.coupon && typeof body.coupon === "object" ? (body.coupon as Record<string, unknown>) : null;
    if (!input) return NextResponse.json({ error: "Nedostaju podaci kupona." }, { status: 400 });

    let payload;
    try {
      payload = validateCouponPayload(input);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    const originalCode =
      typeof body?.originalCode === "string" && body.originalCode ? normalizeCouponCode(body.originalCode) : "";

    if (originalCode) {
      const { data, error } = await updateCoupon(supabaseAdmin, originalCode, payload);
      if (error) {
        const duplicate = error.code === "23505";
        return NextResponse.json(
          { error: duplicate ? `Kupon ${payload.code} već postoji.` : error.message },
          { status: duplicate ? 409 : 500 }
        );
      }
      if (!data) return NextResponse.json({ error: "Kupon nije pronađen." }, { status: 404 });
      return NextResponse.json({ ok: true, code: payload.code });
    }

    const { error } = await insertCoupon(supabaseAdmin, payload);
    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { error: duplicate ? `Kupon ${payload.code} već postoji.` : error.message },
        { status: duplicate ? 409 : 500 }
      );
    }
    return NextResponse.json({ ok: true, code: payload.code });
  } catch (error) {
    console.error("POST /api/admin/coupons error:", error);
    return NextResponse.json({ error: "Greška pri čuvanju kupona." }, { status: 500 });
  }
}

/** Delete a coupon (?code=...). Existing orders keep the stored code and discount. */
export async function DELETE(req: NextRequest) {
  const protection = protectMutationRoute(req, { key: "admin-coupons-delete", limit: 30, windowMs: 60_000 });
  if (protection) return protection;

  const auth = await requireAdminFromCookies();
  if (auth.ok === false) return auth.response;

  const code = normalizeCouponCode(req.nextUrl.searchParams.get("code") ?? "");
  if (!code) return NextResponse.json({ error: "Nedostaje kod kupona." }, { status: 400 });

  const { data, error } = await deleteCoupon(supabaseAdmin, code);
  if (error) {
    console.error("ADMIN COUPON DELETE ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Kupon nije pronađen." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
