import { NextRequest, NextResponse } from "next/server";
import { protectLookupRoute, validateSameOrigin } from "@/shared/lib/request-security";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";

const GUEST_ORDER_SELECT = `
  id,
  order_number,
  status,
  created_at,
  total_rsd,
  order_items (
    id,
    perfume_name,
    perfume_brand,
    ml,
    qty,
    line_total_rsd
  )
`;

function cleanOrderNumber(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const originError = validateSameOrigin(req);
  if (originError) {
    return originError;
  }

  const protection = protectLookupRoute(req, {
    key: "orders-find-by-number",
    limit: 10,
    windowMs: 5 * 60_000,
  });

  if (protection) {
    return protection;
  }

  try {
    const body = await req.json();
    const orderNumber = cleanOrderNumber(body?.orderNumber);
    const email = cleanEmail(body?.email);

    if (!orderNumber) {
      return NextResponse.json(
        { error: "Unesite broj porudžbine." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Unesite email korišćen pri kupovini." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Unesite ispravnu email adresu." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(GUEST_ORDER_SELECT)
      .eq("order_number", orderNumber)
      .ilike("customer_email", email)
      .maybeSingle();

    if (error) {
      console.error("POST /api/orders/find-by-number error:", error);

      return NextResponse.json(
        { error: "Greška pri pretrazi porudžbine." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Porudžbina nije pronađena. Proverite broj porudžbine i email adresu.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error("POST /api/orders/find-by-number unexpected error:", error);

    return NextResponse.json(
      { error: "Greška pri pretrazi porudžbine." },
      { status: 500 }
    );
  }
}
