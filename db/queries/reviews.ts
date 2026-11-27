/**
 * Table: product_reviews
 *
 * The public list per perfume is CACHED (tag "reviews:<perfume id>") so product pages stay static;
 * every write (customer or admin) invalidates that perfume's tag right away.
 * Writes by customers go through their own session (RLS: only verified buyers, only their own review).
 * The public list is read by the server only (service role, migration 018) and never includes user IDs.
 */
import { revalidateTag, unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/db/clients/admin";
import type { Db } from "@/db/types";
import {
  mapReviewRow,
  REVIEW_PUBLIC_COLUMNS,
  summarizeReviews,
  type ProductReviews,
  type ReviewRow,
} from "@/features/reviews/lib/reviews";

const REVIEWS_TAG = "reviews";
const REVIEWS_REVALIDATE_SECONDS = 3600;
/** PostgREST returns at most 1000 rows; no perfume here gets close to that. */
const MAX_REVIEWS_PER_PRODUCT = 1000;

function productReviewsTag(productId: string) {
  return `${REVIEWS_TAG}:${productId}`;
}

async function fetchProductReviews(productId: string): Promise<ProductReviews> {
  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .select(REVIEW_PUBLIC_COLUMNS)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(MAX_REVIEWS_PER_PRODUCT);

  if (error) throw error;

  const reviews = ((data ?? []) as ReviewRow[]).map(mapReviewRow);
  return { reviews, summary: summarizeReviews(reviews) };
}

/** Reviews of one perfume, newest first, with the average and the count per star (cached). */
export function getProductReviews(productId: string) {
  return unstable_cache(() => fetchProductReviews(productId), ["reviews:product", productId], {
    tags: [REVIEWS_TAG, productReviewsTag(productId)],
    revalidate: REVIEWS_REVALIDATE_SECONDS,
  })();
}

/** After a review of this perfume is added, changed or deleted. */
export function revalidateProductReviews(productId: string) {
  revalidateTag(productReviewsTag(productId), { expire: 0 });
}

/** All perfumes at once (e.g. after data was changed directly in Supabase). */
export function revalidateAllReviews() {
  revalidateTag(REVIEWS_TAG, { expire: 0 });
}

/* -------------------------------------------------------------------------- */
/*  Signed-in customer (server client with their session -> RLS)              */
/* -------------------------------------------------------------------------- */

export async function getMyReview(db: Db, userId: string, productId: string) {
  return await db
    .from("product_reviews")
    .select(REVIEW_PUBLIC_COLUMNS)
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle<ReviewRow>();
}

/** Volumes (ml) of this perfume the signed-in customer has received; empty = can't review. */
export async function getMyReceivedMl(db: Db, productId: string) {
  return await db.rpc("my_received_perfume_ml", { p_product_id: productId });
}

export type ReviewWriteRow = {
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  ml: number | null;
  /** Short public name ("Marko P."); with migration 016 the database sets it itself. */
  full_name: string | null;
};

/** New review or a change to the existing one (one per customer per perfume). */
export async function upsertMyReview(db: Db, row: ReviewWriteRow) {
  return await db
    .from("product_reviews")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "product_id,user_id" })
    .select(REVIEW_PUBLIC_COLUMNS)
    .single<ReviewRow>();
}

export async function deleteMyReview(db: Db, userId: string, productId: string) {
  return await db
    .from("product_reviews")
    .delete()
    .eq("product_id", productId)
    .eq("user_id", userId)
    .select("id");
}

/* -------------------------------------------------------------------------- */
/*  Admin (service role)                                                      */
/* -------------------------------------------------------------------------- */

export type AdminReviewRow = ReviewRow & { product_id: string };

/** Newest reviews across all perfumes (moderation); rows are AdminReviewRow. */
export async function listReviewsAdmin(db: Db, limit = 300) {
  return await db
    .from("product_reviews")
    .select(`product_id, ${REVIEW_PUBLIC_COLUMNS}`)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function deleteReviewById(db: Db, id: string) {
  return await db
    .from("product_reviews")
    .delete()
    .eq("id", id)
    .select("id, product_id")
    .maybeSingle<{ id: string; product_id: string }>();
}
