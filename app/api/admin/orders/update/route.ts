import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/shared/lib/request-security";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { updateAdminOrderStatus } from "@/features/admin/orders/server/orders.service";
import type { AdminOrderNextStatus } from "@/features/admin/orders/types";

export async function PATCH(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "admin-orders-update",
    limit: 30,
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

    const body = await req.json();
    const id = Number(body?.id);
    const status = body?.status as AdminOrderNextStatus;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Neispravan id porudžbine." }, { status: 400 });
    }

    if (status !== "confirmed" && status !== "shipped" && status !== "cancelled") {
      return NextResponse.json({ error: "Neispravan status." }, { status: 400 });
    }

    await updateAdminOrderStatus(id, status);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/orders/update error:", error);

    return NextResponse.json(
      { error: "Greška pri ažuriranju statusa." },
      { status: 500 }
    );
  }
}