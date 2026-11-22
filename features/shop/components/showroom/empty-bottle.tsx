import styles from "./empty-bottle.module.css";

/** Perfume without an image yet: a bottle outline on the stage instead of a white "No image" tile. */
export default function EmptyBottle({ className }: { className?: string | undefined }) {
  return (
    <span className={`${styles.wrap} ${className ?? ""}`}>
      <svg viewBox="0 0 100 150" className={styles.svg} aria-hidden="true">
        <rect x="38" y="6" width="24" height="22" rx="4" />
        <rect x="44" y="28" width="12" height="10" />
        <rect x="16" y="38" width="68" height="104" rx="14" />
      </svg>
      <span className={styles.text}>Slika uskoro</span>
    </span>
  );
}
