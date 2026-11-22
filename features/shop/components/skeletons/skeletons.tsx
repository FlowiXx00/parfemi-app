import type { CSSProperties } from "react";
import styles from "./skeletons.module.css";

function Bar({ w, h = 14, r }: { w: string | number; h?: number; r?: number }) {
  const style: CSSProperties = { width: w, height: h, ...(r !== undefined ? { borderRadius: r } : {}) };
  return <span className={styles.block} style={style} />;
}

/** Shop skeleton: header, filters on the left and a grid of cards. */
export function ShopSkeleton() {
  return (
    <div className={styles.container} aria-busy="true" aria-label="Učitavanje parfema">
      <div className={`${styles.panel} ${styles.header}`}>
        <Bar w={90} h={11} />
        <Bar w="min(320px, 70%)" h={38} />
        <Bar w="min(460px, 90%)" />
      </div>

      <div className={styles.layout}>
        <div className={`${styles.panel} ${styles.sidebar}`}>
          <Bar w="40%" h={16} />
          {Array.from({ length: 7 }, (_, i) => (
            <Bar key={i} w={`${60 + ((i * 13) % 35)}%`} h={30} r={999} />
          ))}
        </div>

        <div>
          <div className={styles.toolbar}>
            <Bar w="min(520px, 60%)" h={46} r={14} />
            <Bar w={190} h={46} r={14} />
          </div>
          <div className={styles.grid}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={styles.card}>
                <span className={styles.block} />
                <Bar w="40%" h={10} />
                <Bar w="65%" h={16} />
                <Bar w="35%" h={10} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Product page skeleton: image on the left, name, price and volumes on the right. */
export function ProductSkeleton() {
  return (
    <div className={styles.container} aria-busy="true" aria-label="Učitavanje parfema">
      <Bar w={180} h={12} />
      <div className={styles.product}>
        <span className={`${styles.block} ${styles.visual}`} />
        <div className={styles.buy}>
          <Bar w={80} h={12} />
          <Bar w="75%" h={44} />
          <Bar w="45%" />
          <Bar w={140} h={28} />
          <div className={styles.volumes}>
            <Bar w="100%" h={62} r={16} />
            <Bar w="100%" h={62} r={16} />
            <Bar w="100%" h={62} r={16} />
          </div>
          <Bar w="100%" h={52} r={14} />
          <Bar w="100%" h={44} r={14} />
          <Bar w="100%" h={180} r={22} />
        </div>
      </div>
    </div>
  );
}
