export { formatDateTime as formatDate, formatRsd } from "@/lib/format";
import type { AdminOrderFilterStatus } from "../types";

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