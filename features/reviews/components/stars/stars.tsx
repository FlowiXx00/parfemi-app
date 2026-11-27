import styles from "./stars.module.css";

/** Partially filled stars (e.g. 4.4 -> four full and 40% of the fifth). Decorative: give the number in text. */
export default function Stars({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string | undefined;
}) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));

  return (
    <span className={`${styles.stars} ${styles[size]} ${className ?? ""}`} aria-hidden="true">
      <span className={styles.empty}>★★★★★</span>
      <span className={styles.full} style={{ width: `${percent}%` }}>
        ★★★★★
      </span>
    </span>
  );
}
