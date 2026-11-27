"use client";

import { readJsonSafe, resolveErrorMessage } from "@/lib/http";
import type { MyReviewState, PublicReview } from "@/features/reviews/lib/reviews";

export class ReviewsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ReviewsApiError";
    this.status = status;
  }
}

async function request<T>(input: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const data = await readJsonSafe(response);
  if (!response.ok) throw new ReviewsApiError(response.status, resolveErrorMessage(data, fallback));
  return data as T;
}

/** The signed-in customer's review of this perfume and whether they may write one. */
export async function fetchMyReview(productId: string) {
  return await request<MyReviewState>(
    `/api/reviews/mine?productId=${encodeURIComponent(productId)}`,
    { method: "GET" },
    "Recenzija nije učitana."
  );
}

export async function saveMyReview(payload: { productId: string; rating: number; comment: string; ml: number | null }) {
  const data = await request<{ review: PublicReview }>(
    "/api/reviews",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    "Recenzija nije sačuvana. Pokušaj ponovo."
  );
  return data.review;
}

export async function deleteMyReview(productId: string) {
  await request(`/api/reviews?productId=${encodeURIComponent(productId)}`, { method: "DELETE" }, "Brisanje nije uspelo.");
}
