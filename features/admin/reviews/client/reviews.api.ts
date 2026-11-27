import { readJsonSafe, resolveErrorMessage } from "@/lib/http";
import type { AdminReview } from "../types";

export class AdminReviewsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminReviewsApiError";
    this.status = status;
  }
}

async function request<T>(input: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const data = await readJsonSafe(response);
  if (!response.ok) throw new AdminReviewsApiError(response.status, resolveErrorMessage(data, fallback));
  return data as T;
}

export async function fetchAdminReviews(): Promise<AdminReview[]> {
  const data = await request<{ reviews?: AdminReview[] }>("/api/admin/reviews", { method: "GET" }, "Recenzije nisu učitane.");
  return Array.isArray(data?.reviews) ? data.reviews : [];
}

export async function removeAdminReview(id: string) {
  await request(`/api/admin/reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" }, "Brisanje nije uspelo.");
}
