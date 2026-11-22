// "received" is set by the customer when they confirm delivery (app/api/orders/received).
export type OrderStatus = "pending" | "confirmed" | "shipped" | "received" | "cancelled";

export type AdminOrderFilterStatus =
  | "all"
  | "pending"
  | "confirmed"
  | "shipped"
  | "received"
  | "cancelled";

export type AdminOrderNextStatus = "confirmed" | "shipped" | "cancelled";
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
  order_items: OrderItemRow[];
};
