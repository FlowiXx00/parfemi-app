import { buildOrdersQueryParams } from "../lib/orders.lib";
import type {
  AdminOrderFilterStatus,
  AdminOrderNextStatus,
  OrderRow,
} from "../types";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";

const API_BASE = "/api/admin/orders";

export class AdminOrdersApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminOrdersApiError";
    this.status = status;
  }
}

export async function loadOrders(
  status: AdminOrderFilterStatus,
  query: string
): Promise<OrderRow[]> {
  const params = buildOrdersQueryParams(status, query);

  const response = await fetch(`${API_BASE}/list?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminOrdersApiError(
      response.status,
      resolveErrorMessage(data, "Greška pri učitavanju porudžbina.")
    );
  }

  if (
    data &&
    typeof data === "object" &&
    "orders" in data &&
    Array.isArray(data.orders)
  ) {
    return data.orders as OrderRow[];
  }

  return [];
}

/** Any combination: next status, Post Express shipment number ("" removes it), payment received. */
export type OrderUpdatePatch = {
  status?: AdminOrderNextStatus;
  trackingNumber?: string;
  paid?: boolean;
};

export async function updateOrderRequest(id: number, patch: OrderUpdatePatch): Promise<void> {
  const response = await fetch(`${API_BASE}/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, ...patch }),
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminOrdersApiError(
      response.status,
      resolveErrorMessage(data, "Greška pri ažuriranju porudžbine.")
    );
  }
}

export async function updateOrderStatusRequest(id: number, status: AdminOrderNextStatus): Promise<void> {
  await updateOrderRequest(id, { status });
}