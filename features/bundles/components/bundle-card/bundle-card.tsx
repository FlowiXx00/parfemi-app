"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PiGift } from "react-icons/pi";
import { addToCartAnimated } from "@/features/cart/lib/add-to-cart-animated";
import { bundleCartId } from "@/features/bundles/lib/bundles";
import BottleImg from "@/features/shop/components/showroom/bottle-img";
import type { BundleView } from "@/features/bundles/lib/views";
import { formatRsd } from "@/lib/format";
import styles from "./bundle-card.module.css";

/** Discovery bundle card: bottles, perfume list, savings and "Add bundle to cart". */
export default function BundleCard({ bundle }: { bundle: BundleView }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [added, setAdded] = useState(false);
  const saving = Math.max(0, bundle.regular - bundle.price);

  function add() {
    if (!bundle.available) return;
    addToCartAnimated(
      {
        id: bundleCartId(bundle.id),
        name: bundle.title,
        brand: "Paket za probu",
        imageUrl: bundle.items[0]?.image ?? null,
        ml: bundle.ml,
        priceRsd: bundle.price,
        qty: 1,
        bundleItems: bundle.items.map(({ id, brand, name }) => ({ id, brand, name })),
      },
      buttonRef.current
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <article className={`${styles.card} ${bundle.available ? "" : styles.unavailable}`}>
      <div className={styles.bottles} aria-hidden="true">
        {bundle.items.slice(0, 5).map((item) => (
          <BottleImg key={item.id} src={item.image} precomputed={item.cutout} className={styles.bottle} />
        ))}
        {bundle.discountPct > 0 && <span className={styles.badge}>−{bundle.discountPct}%</span>}
      </div>

      <div className={styles.body}>
        <span className={styles.kicker}>
          <PiGift aria-hidden="true" /> {bundle.items.length} × {bundle.ml} ml
        </span>
        <h2 className={styles.title}>{bundle.title}</h2>
        {bundle.description && <p className={styles.desc}>{bundle.description}</p>}

        <ul className={styles.items}>
          {bundle.items.map((item) => (
            <li key={item.id}>
              <Link href={`/shop/${item.id}`}>
                <span>{item.brand}</span> {item.name}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.footer}>
          <div className={styles.price}>
            {saving > 0 && <s>{formatRsd(bundle.regular)}</s>}
            <strong>{formatRsd(bundle.price)}</strong>
            {saving > 0 && <small>štediš {formatRsd(saving)}</small>}
          </div>
          <button ref={buttonRef} type="button" className={styles.addBtn} disabled={!bundle.available} onClick={add}>
            {!bundle.available ? "Trenutno nedostupno" : added ? "Dodato ✓" : "Dodaj paket u korpu"}
          </button>
        </div>
      </div>
    </article>
  );
}
