"use client";

import { PiTruck } from "react-icons/pi";
import { useShopSettings } from "@/features/orders/client/use-shop-settings";
import { freeShippingProgress } from "@/features/orders/lib/shipping";
import { formatRsd } from "@/lib/format";
import styles from "./free-shipping-bar.module.css";

/** "X RSD more for free shipping" bar (cart page and drawer). The threshold is set in Admin > Settings. */
export default function FreeShippingBar({ goodsTotal, compact = false }: { goodsTotal: number; compact?: boolean }) {
  const settings = useShopSettings();
  const progress = freeShippingProgress(goodsTotal, settings);
  if (goodsTotal <= 0 || !progress || settings.shippingRsd === 0) return null;
  const { missing, percent, reached, threshold } = progress;

  return (
    <div className={`${styles.bar} ${compact ? styles.compact : ""} ${reached ? styles.reached : ""}`} role="status">
      <div className={styles.text}>
        <PiTruck aria-hidden="true" className={styles.icon} />
        {reached ? (
          <span>
            <strong>Dostava je besplatna!</strong>
          </span>
        ) : (
          <span>
            Još <strong>{formatRsd(missing)}</strong> do <strong>besplatne dostave</strong>
          </span>
        )}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={Math.min(goodsTotal, threshold)}
        aria-label="Napredak do besplatne dostave"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
