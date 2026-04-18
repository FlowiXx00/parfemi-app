export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/shared/supabase/supabase-server";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";

const MY_ORDERS_SELECT = `
  id,
  order_number,
  status,
  customer_note,
  subtotal_rsd,
  shipping_rsd,
  total_rsd,
  created_at,
  received_at,
  order_items (
    id,
    perfume_id,
    perfume_name,
    perfume_brand,
    image_url,
    ml,
    qty,
    price_rsd,
    line_total_rsd
  )
`;

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Moraš biti prijavljen." },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(MY_ORDERS_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/orders/my error:", error);

      return NextResponse.json(
        { error: "Greška pri učitavanju porudžbina." },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    console.error("GET /api/orders/my unexpected error:", error);

    return NextResponse.json(
      { error: "Greška pri učitavanju porudžbina." },
      { status: 500 }
    );
  }
}