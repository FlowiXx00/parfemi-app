// "received" (delivered): set by the customer ("I received it", app/api/orders/received) or by the
// admin once Post Express confirms delivery or pays out the cash on delivery.
export type OrderStatus = "pending" | "confirmed" | "shipped" | "received" | "cancelled";

export type AdminOrderFilterStatus =
  | "all"
  | "pending"
  | "confirmed"
  | "shipped"
  | "received"
  | "cancelled";

export type AdminOrderNextStatus = "confirmed" | "shipped" | "received" | "cancelled";

/** Status changes the admin may make (anything else is refused by the API). */
export const ADMIN_STATUS_TRANSITIONS: Record<OrderStatus, AdminOrderNextStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["received"],
  received: [],
  cancelled: [],
};

export type OrderItemRow = {
  id: number;
  perfume_id: string;
  perfume_name: string;
  perfume_brand: string | null;
  ml: number;
  qty: number;
  price_rsd: number;
  line_total_rsd: number;
};

export type OrderRow = {
  id: number;
  order_number: string;
  status: OrderStatus;
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
  created_at: string;
  /** null = guest order (no account). */
  user_id?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  /** Post Express shipment number (migration 017). */
  tracking_number?: string | null;
  /** When the money arrived (IPS transfer or cash on delivery paid out); null = not yet. */
  paid_at?: string | null;
  order_items: OrderItemRow[];
};
