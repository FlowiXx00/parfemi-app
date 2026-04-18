import { createClient } from "@/shared/supabase/supabase-client";
import type { User } from "@supabase/supabase-js";

export type ProductReviewRow = {
  id: string;
  product_id: string;
  user_id: string;
  full_name: string | null;
  rating: number;
  comment: string;
  ml: number | null;
  created_at: string;
  updated_at: string;
};

type AddOrUpdateReviewInput = {
  productId: string;
  rating: number;
  comment: string;
  ml?: number | null;
};

const REVIEW_SELECT =
  "id, product_id, user_id, full_name, rating, comment, ml, created_at, updated_at";

const allowedMlValues = new Set([5, 10, 20, 30]);

function validateReviewInput(input: AddOrUpdateReviewInput) {
  if (!input.productId?.trim()) {
    throw new Error("Nedostaje proizvod.");
  }

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Ocena mora biti broj od 1 do 5.");
  }

  if (typeof input.comment !== "string" || !input.comment.trim()) {
    throw new Error("Komentar je obavezan.");
  }

  if (input.comment.trim().length > 500) {
    throw new Error("Komentar može imati najviše 500 karaktera.");
  }

  if (input.ml != null && !allowedMlValues.has(input.ml)) {
    throw new Error("Neispravna militraža.");
  }
}

async function getRequiredUser() {
  const supabase = createClient();

  if (!supabase) {
    throw new Error("Supabase nije podešen.");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Moraš biti prijavljen.");
  }

  return { supabase, user };
}

async function getUserFullName(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  user: User
) {
  let profileFullName: string | null = null;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!error) {
    profileFullName =
      typeof data?.full_name === "string" && data.full_name.trim()
        ? data.full_name.trim()
        : null;
  } else {
    console.error("Greška pri čitanju full_name iz profiles:", error);
  }

  const metadataFullName =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : typeof user.user_metadata?.name === "string" &&
        user.user_metadata.name.trim()
      ? user.user_metadata.name.trim()
      : null;

  return profileFullName || metadataFullName || "Korisnik";
}

export async function addOrUpdateReview(input: AddOrUpdateReviewInput) {
  validateReviewInput(input);

  const { supabase, user } = await getRequiredUser();
  const fullName = await getUserFullName(supabase, user);

  const payload = {
    product_id: input.productId.trim(),
    user_id: user.id,
    full_name: fullName,
    rating: input.rating,
    comment: input.comment.trim(),
    ml: input.ml ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("product_reviews")
    .upsert(payload, {
      onConflict: "product_id,user_id",
    })
    .select(REVIEW_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as ProductReviewRow;
}

export async function getProductReviews(productId: string) {
  const supabase = createClient();

  if (!supabase) {
    throw new Error("Supabase nije podešen.");
  }

  const { data, error } = await supabase
    .from("product_reviews")
    .select(REVIEW_SELECT)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductReviewRow[];
}

export async function getMyProductReview(productId: string) {
  const { supabase, user } = await getRequiredUser();

  const { data, error } = await supabase
    .from("product_reviews")
    .select(REVIEW_SELECT)
    .eq("product_id", productId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as ProductReviewRow | null;
}

export async function deleteMyReview(productId: string) {
  const { supabase, user } = await getRequiredUser();

  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("product_id", productId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return true;
}