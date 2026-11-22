import Link from "next/link";
import { PiDrop, PiGift } from "react-icons/pi";
import type { CartItem } from "@/features/cart/types";
import styles from "./bundle-contents.module.css";

/** Whether a cart line is a bundle (ready-made "paket:…" or customer "mojpaket:…"). */
export function isBundleItem(item: CartItem) {
  return Boolean(item.bundleItems?.length) || item.id.startsWith("paket:") || item.id.startsWith("mojpaket:");
}

/** Icon in place of the line image (bundle or perfume without an image). */
export function CartThumbFallback({ item }: { item: CartItem }) {
  return (
    <span className={styles.thumbFallback} aria-hidden="true">
      {isBundleItem(item) ? <PiGift /> : <PiDrop />}
    </span>
  );
}

/** Gold badge in the corner of a bundle thumbnail: how many perfumes it contains. */
export function BundleThumbBadge({ item }: { item: CartItem }) {
  if (!isBundleItem(item)) return null;
  const count = item.bundleItems?.length ?? 0;
  return (
    <span className={styles.thumbBadge} aria-hidden="true">
      <PiGift />
      {count > 0 && count}
    </span>
  );
}

/** Bundle contents in the cart: "Paket · 5 × 5 ml" + perfume list (one line, not separate perfumes). */
export default function BundleContents({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const list = item.bundleItems ?? [];
  return (
    <div className={`${styles.box} ${compact ? styles.compact : ""}`}>
      <span className={styles.label}>
        <PiGift aria-hidden="true" /> Paket · {list.length ? `${list.length} × ` : ""}
        {item.ml} ml
      </span>
      {list.length > 0 && (
        <ul className={styles.list}>
          {list.map((perfume) => (
            <li key={perfume.id}>
              <Link href={`/shop/${perfume.id}`}>
                <span>{perfume.brand}</span> {perfume.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
