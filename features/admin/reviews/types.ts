import type { PublicReview } from "@/features/reviews/lib/reviews";

/** A review in the admin list: the public data plus which perfume it belongs to. */
export type AdminReview = PublicReview & {
  productId: string;
  perfumeName: string;
  perfumeBrand: string;
  /** false = the perfume is hidden or deleted (no link to the shop). */
  perfumeVisible: boolean;
};
