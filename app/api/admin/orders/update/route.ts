import { after, NextRequest, NextResponse } from "next/server";
import { emailConfigured } from "@/features/notifications/server/email";
import { sendOrderStatusEmail } from "@/features/notifications/server/order-emails";
import { protectMutationRoute } from "@/lib/request-security";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { supabaseAdmin } from "@/db/clients/admin";
import { getOrderForEmail, updateAdminOrderStatus } from "@/db/queries/orders";
import { revalidateCatalog } from "@/db/queries/perfumes";
import { restoreOrderStock } from "@/db/queries/stock";
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

    await updateAdminOrderStatus(supabaseAdmin, id, status);

    // A cancelled order puts the ml back into stock (once, and only if it consumed any).
    if (status === "cancelled") {
      const { error } = await restoreOrderStock(supabaseAdmin, id);
      if (error) console.error("RESTORE ORDER STOCK ERROR:", error);
      else revalidateCatalog();
    }

    // Email the customer about the new status (after the response; skipped if email isn't configured).
    if (emailConfigured()) {
      after(async () => {
        const { data } = await getOrderForEmail(supabaseAdmin, id);
        if (!data) return;
        const row = data as unknown as {
          order_number: string;
          customer_full_name: string;
          customer_email: string;
          customer_phone: string;
          customer_city: string;
          customer_address: string;
          customer_note: string | null;
          coupon_code: string | null;
          subtotal_rsd: number;
          discount_rsd: number;
          shipping_rsd: number;
          total_rsd: number;
          order_items: { perfume_name: string; ml: number; qty: number; line_total_rsd: number }[] | null;
        };
        await sendOrderStatusEmail(
          {
            orderNumber: row.order_number,
            customerName: row.customer_full_name,
            customerEmail: row.customer_email,
            phone: row.customer_phone,
            city: row.customer_city,
            address: row.customer_address,
            note: row.customer_note,
            couponCode: row.coupon_code,
            subtotalRsd: Number(row.subtotal_rsd),
            discountRsd: Number(row.discount_rsd),
            shippingRsd: Number(row.shipping_rsd),
            totalRsd: Number(row.total_rsd),
            items: (row.order_items ?? []).map((item) => ({
              name: item.perfume_name,
              ml: Number(item.ml),
              qty: Number(item.qty),
              lineTotalRsd: Number(item.line_total_rsd),
            })),
          },
          status
        );
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/orders/update error:", error);

    return NextResponse.json(
      { error: "Greška pri ažuriranju statusa." },
      { status: 500 }
    );
  }
}