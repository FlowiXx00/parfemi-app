export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { supabaseAdmin } from "@/db/clients/admin";
import { listAdminOrders } from "@/db/queries/orders";
import { maskOrderCustomer } from "@/features/admin/demo/mask";
import type { AdminOrderFilterStatus } from "@/features/admin/orders/types";
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminFromCookies({ allowDemo: true });

    if (auth.ok === false) {
      return auth.response;
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query")?.trim() ?? "";
    const status = (searchParams.get("status")?.trim() ?? "all") as AdminOrderFilterStatus;

    const orders = await listAdminOrders(supabaseAdmin, { query, status });

    // The demo account never sees real customer data
    return NextResponse.json({ orders: auth.isDemo ? orders.map(maskOrderCustomer) : orders });
  } catch (error) {
    console.error("GET /api/admin/orders/list error:", error);

    return NextResponse.json(
      { error: "Greška pri učitavanju porudžbina." },
      { status: 500 }
    );
  }
}