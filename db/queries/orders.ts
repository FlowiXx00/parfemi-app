/**
 * Tabele: orders, order_items
 */
import type { Db } from "@/db/types";
import type {
  AdminOrderFilterStatus,
  AdminOrderNextStatus,
  OrderRow,
} from "@/features/admin/orders/types";

/* -------------------------------------------------------------------------- */
/*  SELECT stringovi                                                          */
/* -------------------------------------------------------------------------- */

const ADMIN_ORDERS_SELECT = `
  id,
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

  let request = db
    .from("orders")
    .select(ADMIN_ORDERS_SELECT)
    .order("created_at", { ascending: false });

  if (status !== "all") {
    request = request.eq("status", status);
  }

  if (query) {
    request = request.ilike("order_number", `%${query}%`);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as OrderRow[];
}

export async function updateAdminOrderStatus(
  db: Db,
  id: number,
  status: AdminOrderNextStatus
): Promise<void> {
  const { data, error } = await db
    .from("orders")
    .update({ status })
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

/** Recent orders for the dashboard. */
export async function listRecentOrders(db: Db, limit = 6) {
  return await db
    .from("orders")
    .select("id, order_number, status, customer_full_name, customer_city, total_rsd, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
}

/** Order with its lines for the customer email (status change). */
export async function getOrderForEmail(db: Db, id: number) {
  return await db
    .from("orders")
    .select(
      "order_number, customer_full_name, customer_email, customer_phone, customer_city, customer_address, customer_note, coupon_code, subtotal_rsd, discount_rsd, shipping_rsd, total_rsd, order_items (perfume_name, ml, qty, line_total_rsd)"
    )
    .eq("id", id)
    .maybeSingle();
}

/* -------------------------------------------------------------------------- */
/*  Kupac                                                                     */
/* -------------------------------------------------------------------------- */

export async function listOrdersByUser(db: Db, userId: string) {
  return await db
    .from("orders")
    .select(MY_ORDERS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

/** Guest: finds an order by number + email. */
export async function findGuestOrder(
  db: Db,
  orderNumber: string,
  email: string
) {
  return await db
    .from("orders")
    .select(GUEST_ORDER_SELECT)
    .eq("order_number", orderNumber)
    .ilike("customer_email", email)
    .maybeSingle();
}

export async function getOrderOwnerAndStatus(db: Db, orderId: number) {
  return await db
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();
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
