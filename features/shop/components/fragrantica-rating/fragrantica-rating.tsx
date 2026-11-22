import styles from "./fragrantica-rating.module.css";

type Props = {
  rating: number | null | undefined;
  votes: number | null | undefined;
  /** "compact" for the shop card, "full" for the quick view and the product page */
  variant?: "compact" | "full";
  className?: string | undefined;
};

/** Partially filled stars (e.g. 4.4 -> four full and 40% of the fifth). */
function Stars({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={styles.stars} aria-hidden="true">
      <span className={styles.starsEmpty}>★★★★★</span>
      <span className={styles.starsFull} style={{ width: `${percent}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

/**
 * Fragrantica rating and vote count, always with the source shown
 * (so customers know these aren't reviews from this site). Renders nothing without a rating.
 */
export default function FragranticaRating({ rating, votes, variant = "compact", className }: Props) {
  if (typeof rating !== "number" || !(rating > 0)) return null;

  const votesText = votes ? votes.toLocaleString("sr-RS") : null;

  if (variant === "compact") {
    return (
      <span className={`${styles.compact} ${className ?? ""}`} title="Ocena i broj glasova sa sajta Fragrantica">
        <span className={styles.star} aria-hidden="true">★</span>
        <span className={styles.value}>{rating.toFixed(2)}</span>
        {votesText && <span className={styles.muted}>({votesText})</span>}
        <span className={styles.muted}>· Fragrantica</span>
      </span>
    );
  }

  return (
    <div
      className={`${styles.full} ${className ?? ""}`}
      aria-label={`Ocena ${rating.toFixed(2)} od 5${votesText ? `, ${votesText} glasova` : ""}, izvor Fragrantica`}
    >
      <span className={styles.bigValue}>{rating.toFixed(2)}</span>
      <div className={styles.fullText}>
        <Stars value={rating} />
        <span className={styles.muted}>
          {votesText ? `${votesText} glasova` : "ocena"} · izvor: Fragrantica
        </span>
      </div>
    </div>
  );
}
