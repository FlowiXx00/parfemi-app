/**
 * Tabele: orders, order_items
 */
import type { Db } from "@/db/types";
import { isMissingColumnError } from "@/db/queries/missing-column";
import type {
  AdminOrderFilterStatus,
  AdminOrderNextStatus,
  OrderRow,
} from "@/features/admin/orders/types";

/* -------------------------------------------------------------------------- */
/*  SELECT stringovi                                                          */
/* -------------------------------------------------------------------------- */

/** Columns added by migration 017; left out (with a retry) until it has been run. */
const ORDER_EXTRA_COLUMNS = "tracking_number, paid_at,";

const ADMIN_ORDERS_SELECT = `
  id,
  user_id,
  shipped_at,
  received_at,
  order_number,
  status,
  customer_full_name,
  customer_email,
  customer_phone,
  customer_city,
  customer_address,
  customer_note,
  coupon_code,
  subtotal_rsd,
  discount_rsd,
  shipping_rsd,
  total_rsd,
  created_at,
  order_items (
    id,
    perfume_id,
    perfume_name,
    perfume_brand,
    ml,
    qty,
    price_rsd,
    line_total_rsd
  )
`;

const MY_ORDERS_SELECT = `
  id,
  shipped_at,
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
    ml,
    qty,
    price_rsd,
    line_total_rsd
  )
`;

const GUEST_ORDER_SELECT = `
  id,
  order_number,
  status,
  created_at,
  shipped_at,
  received_at,
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

/* -------------------------------------------------------------------------- */
/*  Admin                                                                     */
/* -------------------------------------------------------------------------- */

export async function listAdminOrders(
  db: Db,
  params: {
    query?: string;
    status?: AdminOrderFilterStatus;
  }
): Promise<OrderRow[]> {
  const query = params.query?.trim() ?? "";
  const status = params.status ?? "all";

  const run = (columns: string) => {
    let request = db.from("orders").select(columns).order("created_at", { ascending: false });
    if (status !== "all") request = request.eq("status", status);
    if (query) request = request.ilike("order_number", `%${escapeLike(query)}%`);
    return request;
  };

  let { data, error } = await run(`${ORDER_EXTRA_COLUMNS} ${ADMIN_ORDERS_SELECT}`);
  if (isMissingColumnError(error)) ({ data, error } = await run(ADMIN_ORDERS_SELECT));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as OrderRow[];
}

/** % and _ are wildcards in ILIKE: escaped so the text is matched literally. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Status change by the admin, with the time of each step. */
export async function updateAdminOrderStatus(
  db: Db,
  id: number,
  status: AdminOrderNextStatus
): Promise<void> {
  const now = new Date().toISOString();
  const timestamps: Record<string, string> =
    status === "confirmed"
      ? { confirmed_at: now }
      : status === "shipped"
        ? { shipped_at: now }
        : status === "received"
          ? { received_at: now }
          : {};

  const { data, error } = await db
    .from("orders")
    .update({ status, ...timestamps })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Porudžbina nije pronađena.");
  }
}

/** Post Express shipment number (null = remove it). */
export async function setOrderTrackingNumber(db: Db, id: number, trackingNumber: string | null) {
  return await db.from("orders").update({ tracking_number: trackingNumber }).eq("id", id).select("id").maybeSingle();
}

/** Payment received (IPS transfer or cash on delivery paid out) or not. */
export async function setOrderPaid(db: Db, id: number, paid: boolean) {
  return await db
    .from("orders")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
}

/** Recent orders for the dashboard. */
export async function listRecentOrders(db: Db, limit = 6) {
  return await db
    .from("orders")
    .select("id, order_number, status, customer_full_name, customer_city, total_rsd, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
}

const ORDER_EMAIL_SELECT =
  "order_number, customer_full_name, customer_email, customer_phone, customer_city, customer_address, customer_note, coupon_code, subtotal_rsd, discount_rsd, shipping_rsd, total_rsd, order_items (perfume_name, ml, qty, line_total_rsd)";

/** Order with its lines for the customer email (status change), with the shipment number if known. */
export async function getOrderForEmail(db: Db, id: number) {
  const result = await db.from("orders").select(`tracking_number, ${ORDER_EMAIL_SELECT}`).eq("id", id).maybeSingle();
  if (!isMissingColumnError(result.error)) return result;
  return await db.from("orders").select(ORDER_EMAIL_SELECT).eq("id", id).maybeSingle();
}

/* -------------------------------------------------------------------------- */
/*  Kupac                                                                     */
/* -------------------------------------------------------------------------- */

export async function listOrdersByUser(db: Db, userId: string) {
  const run = (columns: string) =>
    db.from("orders").select(columns).eq("user_id", userId).order("created_at", { ascending: false });

  const result = await run(`${ORDER_EXTRA_COLUMNS} ${MY_ORDERS_SELECT}`);
  return isMissingColumnError(result.error) ? await run(MY_ORDERS_SELECT) : result;
}

/** Guest: finds an order by number + email (the email is matched exactly, ignoring case). */
export async function findGuestOrder(
  db: Db,
  orderNumber: string,
  email: string
) {
  const run = (columns: string) =>
    db.from("orders").select(columns).eq("order_number", orderNumber).ilike("customer_email", escapeLike(email)).maybeSingle();

  const result = await run(`${ORDER_EXTRA_COLUMNS} ${GUEST_ORDER_SELECT}`);
  return isMissingColumnError(result.error) ? await run(GUEST_ORDER_SELECT) : result;
}

/**
 * Guest orders placed with this email become the account's orders (order history, reviews).
 * Call only for a signed-in user whose email is confirmed. Returns how many were attached.
 */
export async function claimGuestOrders(db: Db, userId: string, email: string) {
  return await db.rpc("claim_guest_orders", { p_user_id: userId, p_email: email });
}

export async function getOrderOwnerAndStatus(db: Db, orderId: number) {
  return await db
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();
}

/** Perfumes in an order (back-in-stock check after a cancellation returns their ml). */
export async function listOrderPerfumeIds(db: Db, orderId: number) {
  const { data } = await db.from("order_items").select("perfume_id").eq("order_id", orderId);
  return [...new Set(((data ?? []) as { perfume_id: string }[]).map((row) => row.perfume_id))];
}

/* -------------------------------------------------------------------------- */
/*  Review request email (daily job)                                          */
/* -------------------------------------------------------------------------- */

export type ReviewRequestOrderRow = {
  id: number;
  order_number: string;
  user_id: string | null;
  customer_full_name: string;
  customer_email: string;
  order_items: { perfume_id: string; perfume_name: string; perfume_brand: string | null }[] | null;
};

/** Delivered orders between `minDays` and `maxDays` ago that haven't been asked for a review yet. */
export async function listOrdersForReviewRequest(db: Db, minDays: number, maxDays: number, limit: number) {
  const day = 24 * 60 * 60 * 1000;
  return await db
    .from("orders")
    .select("id, order_number, user_id, customer_full_name, customer_email, order_items (perfume_id, perfume_name, perfume_brand)")
    .eq("status", "received")
    .is("review_request_sent_at", null)
    .lte("received_at", new Date(Date.now() - minDays * day).toISOString())
    .gte("received_at", new Date(Date.now() - maxDays * day).toISOString())
    .order("received_at", { ascending: true })
    .limit(limit);
}

export async function markReviewRequestSent(db: Db, orderId: number) {
  return await db.from("orders").update({ review_request_sent_at: new Date().toISOString() }).eq("id", orderId);
}

export async function markOrderReceived(db: Db, orderId: number) {
  return await db
    .from("orders")
    .update({
      status: "received",
      received_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, status, received_at")
    .single();
}

/**
 * Number of the user's orders with this perfume that are on their way (shipped, not yet confirmed as
 * received). Reviews: "confirm receipt and you can review it".
 */
export async function countShippedOrdersWithPerfume(db: Db, userId: string, perfumeId: string) {
  return await db
    .from("orders")
    .select("id, order_items!inner(perfume_id)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "shipped")
    .eq("order_items.perfume_id", perfumeId);
}

/* -------------------------------------------------------------------------- */
/* Order creation */
/* -------------------------------------------------------------------------- */

export type OrderInsertRow = {
  user_id: string | null;
  status: string;
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
  /** 'consumed' = the order deducted ml from stock (returned if it gets cancelled). */
  stock_state?: "none" | "consumed";
};

export type OrderItemInsertRow = {
  order_id: number;
  perfume_id: string;
  perfume_name: string;
  perfume_brand: string;
  ml: number;
  qty: number;
  price_rsd: number;
  line_total_rsd: number;
};

export async function insertOrder(db: Db, row: OrderInsertRow) {
  return await db
    .from("orders")
    .insert(row)
    .select("id, order_number")
    .single();
}

export async function insertOrderItems(db: Db, rows: OrderItemInsertRow[]) {
  return await db.from("order_items").insert(rows);
}

export async function deleteOrderById(db: Db, orderId: number) {
  return await db.from("orders").delete().eq("id", orderId);
}
