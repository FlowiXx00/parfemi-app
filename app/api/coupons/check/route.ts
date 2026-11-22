import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { supabaseAdmin } from "@/db/clients/admin";
import { getCouponByCode } from "@/db/queries/coupons";
import { checkCoupon, COUPON_CODE_RE, normalizeCouponCode } from "@/features/orders/lib/coupons";

/**
 * Cart coupon check: { code, subtotal } -> { coupon } or { error }.
 * Attempts are rate limited per IP so codes can't be brute-forced.
 * The final check (and counting the use) happens only when the order is placed.
 */
export async function POST(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "coupons-check",
    limit: 15,
    windowMs: 10 * 60_000,
  });

  if (protection) {
    return protection;
  }

  try {
    const body = (await req.json().catch(() => null)) as { code?: unknown; subtotal?: unknown } | null;
    const code = normalizeCouponCode(typeof body?.code === "string" ? body.code : "");
    const subtotal = Math.max(0, Number(body?.subtotal) || 0);

    if (!code) {
      return NextResponse.json({ error: "Unesite kupon kod." }, { status: 400 });
    }

    if (!COUPON_CODE_RE.test(code)) {
      return NextResponse.json({ error: "Kupon nije pronađen." }, { status: 404 });
    }

    const { data, error } = await getCouponByCode(supabaseAdmin, code);

    if (error) {
      console.error("COUPON CHECK ERROR:", error);
      return NextResponse.json({ error: "Provera kupona trenutno nije moguća." }, { status: 500 });
    }

    const result = checkCoupon(data ?? null, subtotal);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: data ? 400 : 404 });
    }

    return NextResponse.json({ coupon: result.coupon });
  } catch (error) {
    console.error("POST /api/coupons/check error:", error);
    return NextResponse.json({ error: "Provera kupona trenutno nije moguća." }, { status: 500 });
  }
}
