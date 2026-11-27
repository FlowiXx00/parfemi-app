import Stars from "@/features/reviews/components/stars/stars";
import { formatRating, reviewCountLabel, type ReviewSummary } from "@/features/reviews/lib/reviews";
import styles from "./reviews-badge.module.css";

/** Under the perfume name: average of this shop's customer reviews, links to the reviews section. */
export default function ReviewsBadge({ summary }: { summary: ReviewSummary }) {
  if (!summary.count) return null;

  return (
    <a href="#recenzije" className={styles.badge}>
      <Stars value={summary.average} />
      <span className={styles.value}>{formatRating(summary.average)}</span>
      <span className={styles.count}>
        {reviewCountLabel(summary.count)} kupaca
      </span>
    </a>
  );
}
