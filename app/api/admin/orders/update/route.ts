import { after, NextRequest, NextResponse } from "next/server";
import { emailConfigured } from "@/features/notifications/server/email";
import { sendOrderStatusEmail, type OrderEmailData } from "@/features/notifications/server/order-emails";
import { notifyBackInStock } from "@/features/stock-alerts/server/notify";
import { protectMutationRoute } from "@/lib/request-security";
import { requireAdminFromCookies } from "@/features/auth/server/require-admin";
import { supabaseAdmin } from "@/db/clients/admin";
import {
  getOrderForEmail,
  getOrderOwnerAndStatus,
  listOrderPerfumeIds,
  setOrderPaid,
  setOrderTrackingNumber,
  updateAdminOrderStatus,
} from "@/db/queries/orders";
import { revalidateCatalog } from "@/db/queries/perfumes";
import { restoreOrderStock } from "@/db/queries/stock";
import { ADMIN_STATUS_TRANSITIONS, type AdminOrderNextStatus, type OrderStatus } from "@/features/admin/orders/types";
import { normalizeTrackingNumber } from "@/features/orders/lib/tracking";

const NEXT_STATUSES: AdminOrderNextStatus[] = ["confirmed", "shipped", "received", "cancelled"];

type EmailRow = {
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
  tracking_number?: string | null;
  order_items: { perfume_name: string; ml: number; qty: number; line_total_rsd: number }[] | null;
};

function toEmailData(row: EmailRow): OrderEmailData {
  return {
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
    trackingNumber: row.tracking_number ?? null,
    items: (row.order_items ?? []).map((item) => ({
      name: item.perfume_name,
      ml: Number(item.ml),
      qty: Number(item.qty),
      lineTotalRsd: Number(item.line_total_rsd),
    })),
  };
}

/**
 * Admin changes to an order. Body: { id, status?, trackingNumber?, paid? } (any combination).
 * - status: next step (confirmed → shipped → received, or cancelled); the customer gets an email
 * - trackingNumber: Post Express shipment number ("" removes it); set it before "shipped" and it goes
 *   into the shipping email
 * - paid: payment received (IPS transfer or cash on delivery paid out) or not
 */
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

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = Number(body?.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Neispravan id porudžbine." }, { status: 400 });
    }

    const status = body?.status === undefined ? null : (body.status as AdminOrderNextStatus);
    if (status !== null && !NEXT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Neispravan status." }, { status: 400 });
    }

    const hasTracking = body !== null && "trackingNumber" in body;
    const rawTracking = typeof body?.trackingNumber === "string" ? body.trackingNumber.trim() : "";
    const trackingNumber = rawTracking ? normalizeTrackingNumber(rawTracking) : null;
    if (hasTracking && rawTracking && !trackingNumber) {
      return NextResponse.json(
        { error: "Broj pošiljke može imati samo slova, brojeve i crtice (4–40 znakova)." },
        { status: 400 }
      );
    }

    const hasPaid = typeof body?.paid === "boolean";
    if (status === null && !hasTracking && !hasPaid) {
      return NextResponse.json({ error: "Nema izmena." }, { status: 400 });
    }

    const { data: current, error: currentError } = await getOrderOwnerAndStatus(supabaseAdmin, id);
    if (currentError) {
      console.error("ADMIN ORDER READ ERROR:", currentError);
      return NextResponse.json({ error: "Greška pri čitanju porudžbine." }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: "Porudžbina nije pronađena." }, { status: 404 });
    }

    const currentStatus = (current as { status: OrderStatus }).status;
    if (status !== null && !ADMIN_STATUS_TRANSITIONS[currentStatus]?.includes(status)) {
      return NextResponse.json({ error: "Ova promena statusa nije moguća za ovu porudžbinu." }, { status: 409 });
    }

    // The shipment number first, so the "shipped" email already has it.
    if (hasTracking) {
      const { error } = await setOrderTrackingNumber(supabaseAdmin, id, trackingNumber);
      if (error) {
        console.error("ADMIN ORDER TRACKING ERROR:", error);
        return NextResponse.json({ error: "Broj pošiljke nije sačuvan." }, { status: 500 });
      }
    }

    if (hasPaid) {
      const { error } = await setOrderPaid(supabaseAdmin, id, body?.paid === true);
      if (error) {
        console.error("ADMIN ORDER PAID ERROR:", error);
        return NextResponse.json({ error: "Oznaka uplate nije sačuvana." }, { status: 500 });
      }
    }

    if (status !== null) {
      await updateAdminOrderStatus(supabaseAdmin, id, status);

      // A cancelled order puts the ml back into stock (once, and only if it consumed any), which may
      // make perfumes available again for customers waiting for them.
      if (status === "cancelled") {
        const { error } = await restoreOrderStock(supabaseAdmin, id);
        if (error) {
          console.error("RESTORE ORDER STOCK ERROR:", error);
        } else {
          revalidateCatalog();
          after(async () => {
            await notifyBackInStock(await listOrderPerfumeIds(supabaseAdmin, id));
          });
        }
      }

      // Email the customer about the new status (after the response; skipped if email isn't configured).
      // Delivered orders get no email now: the review request comes a few days later (daily job).
      if (emailConfigured() && status !== "received") {
        after(async () => {
          const { data } = await getOrderForEmail(supabaseAdmin, id);
          if (!data) return;
          await sendOrderStatusEmail(toEmailData(data as unknown as EmailRow), status);
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/orders/update error:", error);

    return NextResponse.json(
      { error: "Greška pri ažuriranju porudžbine." },
      { status: 500 }
    );
  }
}
