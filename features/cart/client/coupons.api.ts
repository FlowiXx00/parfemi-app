import type { Coupon } from "@/features/orders/lib/coupons";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";

/** Checks a coupon on the server (coupons live in the database, not in the site code). */
export async function checkCouponCode(
  code: string,
  subtotal: number
): Promise<{ ok: true; coupon: Coupon } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/coupons/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await readJsonSafe(response);

    if (!response.ok) {
      return { ok: false, error: resolveErrorMessage(data, "Kupon nije pronađen.") };
    }

    const coupon = data && typeof data === "object" && "coupon" in data ? (data.coupon as Coupon) : null;
    if (!coupon || typeof coupon.code !== "string") {
      return { ok: false, error: "Kupon nije pronađen." };
    }
    return { ok: true, coupon };
  } catch {
    return { ok: false, error: "Provera kupona nije uspela. Proveri internet i pokušaj ponovo." };
  }
}
