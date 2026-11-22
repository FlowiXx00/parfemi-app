export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/db/clients/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { listOrdersByUser } from "@/db/queries/orders";

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

    const { data, error } = await listOrdersByUser(supabaseAdmin, user.id);

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
