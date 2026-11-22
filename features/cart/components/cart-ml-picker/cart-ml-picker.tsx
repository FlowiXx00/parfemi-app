"use client";

import { useMemo } from "react";
import { useCatalog } from "@/features/shop/client/catalog.api";
import styles from "./cart-ml-picker.module.css";

/**
 * Volume buttons for a perfume in the cart (e.g. 5 / 10 / 20 ml).
 * A click changes the volume of the existing line, no remove and re-add.
 * Volumes and prices come from the cached catalog (always current prices).
 */
export default function CartMlPicker({
  productId,
  currentMl,
  onChange,
  size = "sm",
}: {
  productId: string;
  currentMl: number;
  onChange: (toMl: number, priceRsd: number) => void;
  size?: "sm" | "md";
}) {
  const catalog = useCatalog(true);

  const variants = useMemo(() => {
    const product = catalog.find((item) => item.id === productId);
    return product ? [...product.variants].sort((a, b) => a.ml - b.ml) : [];
  }, [catalog, productId]);

  // Until the catalog loads (or if the perfume has only one volume), show just the current one.
  if (variants.length < 2) {
    return <span className={styles.single}>{currentMl} ml</span>;
  }

  return (
    <div className={`${styles.picker} ${size === "md" ? styles.md : ""}`} role="radiogroup" aria-label="Zapremina">
      {variants.map((variant) => {
        const active = variant.ml === currentMl;
        return (
          <button
            key={variant.ml}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!variant.inStock && !active}
            className={`${styles.option} ${active ? styles.active : ""}`}
            onClick={() => {
              if (!active) onChange(variant.ml, variant.priceRsd);
            }}
            title={variant.inStock ? undefined : "Trenutno nema na stanju"}
          >
            {variant.ml} ml
          </button>
        );
      })}
    </div>
  );
}
