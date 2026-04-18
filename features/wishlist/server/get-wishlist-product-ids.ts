import { createClient } from "@/shared/supabase/supabase-server";

export async function getWishlistProductIds(): Promise<string[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("Greška pri čitanju wishlist product ids:", error);
    return [];
  }

  return (data ?? []).map((item) => item.product_id);
}