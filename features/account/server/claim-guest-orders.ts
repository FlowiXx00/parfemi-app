import "server-only";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/db/clients/admin";
import { claimGuestOrders } from "@/db/queries/orders";

/**
 * Orders placed without an account, with the same email as this signed-in customer, become theirs
 * (order history, delivery status, reviews). Only for a confirmed email: Supabase confirms the address
 * at sign-up (or Google does), so the email really belongs to the customer. Never throws.
 */
export async function claimGuestOrdersFor(user: Pick<User, "id" | "email" | "email_confirmed_at"> | null) {
  if (!user?.email || !user.email_confirmed_at) return 0;

  try {
    const { data, error } = await claimGuestOrders(supabaseAdmin, user.id, user.email);
    if (error) {
      // Before migration 017 the function doesn't exist yet.
      if (error.code !== "PGRST202" && error.code !== "42883") console.error("CLAIM GUEST ORDERS ERROR:", error.message);
      return 0;
    }
    return Number(data) || 0;
  } catch (error) {
    console.error("CLAIM GUEST ORDERS ERROR:", error);
    return 0;
  }
}
