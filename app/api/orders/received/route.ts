import { NextRequest, NextResponse } from "next/server";
import { protectMutationRoute } from "@/lib/request-security";
import { createClient } from "@/db/clients/server";
import { supabaseAdmin } from "@/db/clients/admin";
import { getOrderOwnerAndStatus, markOrderReceived } from "@/db/queries/orders";

export async function PATCH(req: NextRequest) {
  const protection = protectMutationRoute(req, {
    key: "orders-received",
    limit: 10,
    windowMs: 60_000,
  });

  if (protection) {
    return protection;
  }

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

    const body = await req.json();
    const rawOrderId = body?.orderId;

    const orderId =
      typeof rawOrderId === "number"
        ? rawOrderId
        : Number(String(rawOrderId ?? "").trim());

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "Neispravan ID porudžbine." },
        { status: 400 }
      );
    }

    const { data: existingOrder, error: existingOrderError } =
      await getOrderOwnerAndStatus(supabaseAdmin, orderId);

    if (existingOrderError) {
      console.error("ORDER RECEIVED FETCH ERROR:", existingOrderError);
      return NextResponse.json(
        { error: "Greška pri proveri porudžbine." },
        { status: 500 }
      );
    }

    if (!existingOrder) {
      return NextResponse.json(
        { error: "Porudžbina nije pronađena." },
        { status: 404 }
      );
    }

    if (existingOrder.user_id !== user.id) {
      return NextResponse.json(
        { error: "Nemaš pristup ovoj porudžbini." },
        { status: 403 }
      );
    }

    if (existingOrder.status !== "shipped") {
      return NextResponse.json(
        { error: "Samo poslata porudžbina može biti označena kao preuzeta." },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error: updateError } = await markOrderReceived(
      supabaseAdmin,
      orderId
    );

    if (updateError) {
      console.error("ORDER RECEIVED UPDATE ERROR:", updateError);
      return NextResponse.json(
        {
          error:
            updateError.message || "Greška pri potvrdi preuzimanja pošiljke.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("PATCH /api/orders/received unexpected error:", error);

    return NextResponse.json(
      { error: "Greška pri potvrdi preuzimanja pošiljke." },
      { status: 500 }
    );
  }
}