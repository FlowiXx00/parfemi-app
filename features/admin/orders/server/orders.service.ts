import { supabaseAdmin } from "@/shared/supabase/supabase-admin";
import type {
  AdminOrderFilterStatus,
  AdminOrderNextStatus,
  OrderRow,
} from "../types";

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
    image_url,
    ml,
    qty,
    price_rsd,
    line_total_rsd
  )
`;

export async function listAdminOrders(params: {
  query?: string;
  status?: AdminOrderFilterStatus;
}): Promise<OrderRow[]> {
  const query = params.query?.trim() ?? "";
  const status = params.status ?? "all";

  let request = supabaseAdmin
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

  return (data ?? []) as OrderRow[];
}

export async function updateAdminOrderStatus(
  id: number,
  status: AdminOrderNextStatus
): Promise<void> {
  const { data, error } = await supabaseAdmin
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