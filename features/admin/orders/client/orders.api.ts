import { buildOrdersQueryParams } from "../lib/orders.lib";
import type {
  AdminOrderFilterStatus,
  AdminOrderNextStatus,
  OrderRow,
} from "../types";

const API_BASE = "/api/admin/orders";

export class AdminOrdersApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminOrdersApiError";
    this.status = status;
  }
}

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resolveErrorMessage(data: unknown, fallback: string) {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }

  return fallback;
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

export async function updateOrderStatusRequest(
  id: number,
  status: AdminOrderNextStatus
): Promise<void> {
  const response = await fetch(`${API_BASE}/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, status }),
  });

  const data = await readJsonSafe(response);

  if (!response.ok) {
    throw new AdminOrdersApiError(
      response.status,
      resolveErrorMessage(data, "Greška pri ažuriranju statusa.")
    );
  }
}