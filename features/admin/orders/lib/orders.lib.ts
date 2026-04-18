import type {
  AdminOrderFilterStatus,
  OrderRow,
  OrdersStats,
  OrderStatus,
} from "../types";

export function formatRsd(value: number): string {
  return `${new Intl.NumberFormat("sr-RS").format(value)} rsd`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getStatusLabel(status: OrderStatus): string {
  if (status === "pending") return "Nova";
  if (status === "confirmed") return "Potvrđena";
  if (status === "shipped") return "Poslata";
  return "Otkazana";
}

export function calculateOrderStats(orders: OrderRow[]): OrdersStats {
  const totalOrders = orders.length;

  const totalRevenue = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total_rsd, 0);

  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const confirmedCount = orders.filter((order) => order.status === "confirmed").length;

  return {
    totalOrders,
    totalRevenue,
    pendingCount,
    confirmedCount,
  };
}

export function buildOrdersQueryParams(
  status: AdminOrderFilterStatus,
  query: string
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("status", status);

  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    params.set("query", trimmedQuery);
  }

  return params;
}