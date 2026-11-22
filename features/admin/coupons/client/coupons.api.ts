import type { CouponRow } from "@/features/orders/lib/coupons";
import type { CouponPayload } from "../lib/coupon-form";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";

export class AdminCouponsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminCouponsApiError";
    this.status = status;
  }
}

async function request<T>(input: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const data = await readJsonSafe(response);
  if (!response.ok) throw new AdminCouponsApiError(response.status, resolveErrorMessage(data, fallback));
  return data as T;
}

export async function fetchCoupons(): Promise<CouponRow[]> {
  const data = await request<{ coupons?: CouponRow[] }>("/api/admin/coupons", { method: "GET" }, "Kuponi nisu učitani.");
  return Array.isArray(data?.coupons) ? data.coupons : [];
}

/** originalCode = updating an existing coupon; without it = new coupon. */
export async function saveCoupon(coupon: CouponPayload, originalCode?: string) {
  await request(
    "/api/admin/coupons",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coupon, originalCode: originalCode ?? null }),
    },
    "Čuvanje kupona nije uspelo."
  );
}

export async function removeCoupon(code: string) {
  await request(`/api/admin/coupons?code=${encodeURIComponent(code)}`, { method: "DELETE" }, "Brisanje nije uspelo.");
}
