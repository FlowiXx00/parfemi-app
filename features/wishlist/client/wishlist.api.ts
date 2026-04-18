"use client";

import { createClient } from "@/shared/supabase/supabase-client";
import type { WishlistItem } from "@/features/wishlist/types";

function emitWishlistUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("wishlist:updated"));
  }
}

function isMissingAuthSessionError(error: unknown) {
  return (
    error instanceof Error &&
    error.name === "AuthSessionMissingError"
  );
}

async function getAuthUserId() {
  const supabase = createClient();

  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      if (isMissingAuthSessionError(error)) {
        return null;
      }

      console.error("Greška pri čitanju auth sesije:", error);
      return null;
    }

    return session?.user?.id ?? null;
  } catch (error) {
    if (isMissingAuthSessionError(error)) {
      return null;
    }

    console.error("Greška pri čitanju auth user-a:", error);
    return null;
  }
}

export async function readWishlist(): Promise<WishlistItem[]> {
  const supabase = createClient();

  if (!supabase) return [];

  const userId = await getAuthUserId();

  if (!userId) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id, user_id, product_id, preferred_ml, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Greška pri čitanju wishlist-a:", error);
    return [];
  }

  return (data ?? []) as WishlistItem[];
}

export async function isInWishlist(productId: string): Promise<boolean> {
  const supabase = createClient();

  if (!supabase) return false;

  const userId = await getAuthUserId();

  if (!userId) return false;

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    console.error("Greška pri proveri wishlist-a:", error);
    return false;
  }

  return !!data;
}

export async function addToWishlist(
  productId: string,
  meta?: {
    preferred_ml?: number | null;
    note?: string | null;
  }
): Promise<boolean> {
  const supabase = createClient();

  if (!supabase) return false;

  const userId = await getAuthUserId();

  if (!userId) return false;

  const { error } = await supabase.from("wishlist_items").insert({
    user_id: userId,
    product_id: productId,
    preferred_ml: meta?.preferred_ml ?? null,
    note: meta?.note ?? null,
  });

  if (error) {
    console.error("Greška pri dodavanju u wishlist:", error);
    return false;
  }

  emitWishlistUpdated();
  return true;
}

export async function removeFromWishlist(productId: string): Promise<boolean> {
  const supabase = createClient();

  if (!supabase) return false;

  const userId = await getAuthUserId();

  if (!userId) return false;

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) {
    console.error("Greška pri uklanjanju iz wishlist-a:", error);
    return false;
  }

  emitWishlistUpdated();
  return true;
}

export async function toggleWishlist(
  productId: string,
  meta?: {
    preferred_ml?: number | null;
    note?: string | null;
  }
): Promise<boolean> {
  const exists = await isInWishlist(productId);

  if (exists) {
    return removeFromWishlist(productId);
  }

  return addToWishlist(productId, meta);
}
