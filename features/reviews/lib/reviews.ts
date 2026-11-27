/**
 * Customer reviews (table product_reviews).
 *
 * Only a customer whose order with that perfume was delivered (status "received") can review it, once
 * per perfume. The rule lives in the database (RLS, migration 011); the site only shows the form to
 * those customers. The public name is the first name + initial of the last name ("Marko P."), never the
 * full name.
 *
 * Pure logic (no React, no database), shared by the product page, the API routes and the admin.
 */

export const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;
/** Shown when the customer has no name in their profile. */
export const ANONYMOUS_REVIEWER = "Kupac";

/** Columns anyone may see (no user_id). */
export const REVIEW_PUBLIC_COLUMNS = "id, rating, comment, ml, full_name, created_at, updated_at";

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string;
  ml: number | null;
  full_name: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  ml: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewSummary = {
  count: number;
  /** Average rounded to one decimal (0 without reviews). */
  average: number;
  /** Reviews per star: index 0 = 1 star … index 4 = 5 stars. */
  distribution: number[];
};

export type ProductReviews = { reviews: PublicReview[]; summary: ReviewSummary };

export const EMPTY_PRODUCT_REVIEWS: ProductReviews = {
  reviews: [],
  summary: { count: 0, average: 0, distribution: [0, 0, 0, 0, 0] },
};

/** What the signed-in customer may do with the review form of one perfume (/api/reviews/mine). */
export type MyReviewState = {
  review: PublicReview | null;
  /** Volumes of this perfume the customer received; empty = can't review (yet). */
  receivedMl: number[];
  /** The order with this perfume is on its way: once it's confirmed as received, the form opens. */
  pendingReceipt: boolean;
  /** Name the review is published under ("Marko P."). */
  displayName: string;
};

function clampRating(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function mapReviewRow(row: ReviewRow): PublicReview {
  return {
    id: String(row.id),
    rating: clampRating(Number(row.rating)),
    comment: String(row.comment ?? ""),
    ml: row.ml === null || row.ml === undefined ? null : Number(row.ml),
    name: row.full_name?.trim() || ANONYMOUS_REVIEWER,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export function summarizeReviews(reviews: { rating: number }[]): ReviewSummary {
  const distribution = [0, 0, 0, 0, 0];
  let total = 0;

  for (const review of reviews) {
    const rating = clampRating(review.rating);
    distribution[rating - 1] = (distribution[rating - 1] ?? 0) + 1;
    total += rating;
  }

  const count = reviews.length;
  return { count, average: count ? Math.round((total / count) * 10) / 10 : 0, distribution };
}

/**
 * "marko petrović" -> "Marko P.", "Marko" -> "Marko", "" -> null.
 * Same rule as the database trigger (migration 016), which has the final say.
 */
export function shortDisplayName(fullName: string | null | undefined): string | null {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstPart = parts[0];
  if (!firstPart) return null;

  const firstChars = Array.from(firstPart).slice(0, 40);
  const first = (firstChars[0] ?? "").toLocaleUpperCase("sr") + firstChars.slice(1).join("");
  if (parts.length === 1) return first;

  const initial = Array.from(parts[parts.length - 1] ?? "")[0]?.toLocaleUpperCase("sr") ?? "";
  return initial ? `${first} ${initial}.` : first;
}

/** Comment cleanup: no control or text-direction characters, single spaces, at most one empty line. */
export function cleanReviewComment(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\P{Cc}\n]/gu, "")
    .replace(/[‪-‮⁦-⁩]/g, "")
    .replace(/[  ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ReviewInput = { productId: string; rating: number; comment: string; ml: number | null };

/** Validates the body of POST /api/reviews. */
export function parseReviewInput(body: unknown): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  const data = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const productId = typeof data.productId === "string" ? data.productId.trim() : "";
  if (!productId || productId.length > 200) return { ok: false, error: "Nedostaje parfem." };

  const rating = Number(data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Izaberi ocenu od 1 do 5 zvezdica." };
  }

  const comment = cleanReviewComment(typeof data.comment === "string" ? data.comment : "");
  if (comment.length < REVIEW_COMMENT_MIN) {
    return { ok: false, error: `Napiši bar ${REVIEW_COMMENT_MIN} karaktera o mirisu.` };
  }
  if (comment.length > REVIEW_COMMENT_MAX) {
    return { ok: false, error: `Recenzija može imati najviše ${REVIEW_COMMENT_MAX} karaktera.` };
  }

  let ml: number | null = null;
  if (data.ml !== null && data.ml !== undefined && data.ml !== "") {
    const value = Number(data.ml);
    if (!Number.isInteger(value) || value <= 0 || value > 1000) return { ok: false, error: "Neispravna zapremina." };
    ml = value;
  }

  return { ok: true, value: { productId, rating, comment, ml } };
}

/** Volumes from the database (the rpc returns int[]): unique, positive, ascending. */
export function normalizeMlList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const volumes = value.map(Number).filter((ml) => Number.isInteger(ml) && ml > 0);
  return [...new Set(volumes)].sort((a, b) => a - b);
}

/**
 * Volume stored with the review: the chosen one, only if the customer received it; without a choice,
 * the only received volume (or none when there were several).
 */
export function resolveReviewMl(requested: number | null, receivedMl: number[]): { ok: true; ml: number | null } | { ok: false } {
  if (requested !== null) return receivedMl.includes(requested) ? { ok: true, ml: requested } : { ok: false };
  return { ok: true, ml: receivedMl.length === 1 ? (receivedMl[0] ?? null) : null };
}

/** 4.75 -> "4,8" */
export function formatRating(value: number) {
  return value.toFixed(1).replace(".", ",");
}

/** Serbian plural: 1 recenzija, 2–4 recenzije, 5+ recenzija (21 recenzija, 22 recenzije, 12 recenzija). */
export function reviewCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "recenzije" : "recenzija";
  return `${count} ${word}`;
}

/** 1 zvezdica, 2–4 zvezdice, 5 zvezdica */
export function starsLabel(rating: number) {
  if (rating === 1) return "1 zvezdica";
  return rating >= 2 && rating <= 4 ? `${rating} zvezdice` : `${rating} zvezdica`;
}

const MONTHS = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
];

const belgradeDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Belgrade",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

/** ISO -> "27. novembar 2026." in Belgrade time (same on the server and in the browser, no hydration mismatch). */
export function formatReviewDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(belgradeDate.formatToParts(date).map((part) => [part.type, part.value]));
  const month = MONTHS[Number(parts.month) - 1] ?? "";
  return `${Number(parts.day)}. ${month} ${parts.year}.`;
}

/** Changed later (more than a minute after it was posted). */
export function isEditedReview(review: Pick<PublicReview, "createdAt" | "updatedAt">) {
  return Date.parse(review.updatedAt) - Date.parse(review.createdAt) > 60_000;
}

export type ReviewSort = "newest" | "highest" | "lowest";

export function sortReviews(reviews: PublicReview[], sort: ReviewSort) {
  const newest = (a: PublicReview, b: PublicReview) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
  const copy = [...reviews];
  if (sort === "highest") return copy.sort((a, b) => b.rating - a.rating || newest(a, b));
  if (sort === "lowest") return copy.sort((a, b) => a.rating - b.rating || newest(a, b));
  return copy.sort(newest);
}

/**
 * schema.org fields for the Product markup. Unlike the Fragrantica rating, these reviews come from this
 * shop's own (verified) customers, which is what Google requires for aggregateRating.
 */
export function reviewsStructuredData({ reviews, summary }: ProductReviews, maxReviews = 5) {
  if (!summary.count) return {};

  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: summary.average,
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, maxReviews).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.name },
      datePublished: review.createdAt.slice(0, 10),
      reviewBody: review.comment,
      reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 },
    })),
  };
}
