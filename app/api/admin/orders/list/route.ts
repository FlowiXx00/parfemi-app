export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { listAdminOrders } from "@/features/admin/orders/server/orders.service";
import type { AdminOrderFilterStatus } from "@/features/admin/orders/types";
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminFromCookies();

    if (auth.ok === false) {
      return auth.response;
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query")?.trim() ?? "";
    const status = (searchParams.get("status")?.trim() ?? "all") as AdminOrderFilterStatus;

    const orders = await listAdminOrders({ query, status });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/admin/orders/list error:", error);

    return NextResponse.json(
      { error: "Greška pri učitavanju porudžbina." },
      { status: 500 }
    );
  }
}