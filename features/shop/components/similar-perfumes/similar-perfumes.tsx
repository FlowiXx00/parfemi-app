"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import ShowcaseCard from "@/features/shop/components/showroom/showcase-card";
import type { CatalogProduct } from "@/features/shop/types";
import styles from "./similar-perfumes.module.css";

/** "If you like X, try…" below the product page (same cards as the shop). */
export default function SimilarPerfumes({ productName, products }: { productName: string; products: CatalogProduct[] }) {
  const router = useRouter();
  const open = useCallback((id: string) => router.push(`/shop/${encodeURIComponent(id)}`), [router]);

  if (!products.length) return null;

  return (
    <section className={styles.section} aria-labelledby="similar-title">
      <span className={styles.kicker}>Slični mirisi</span>
      <h2 id="similar-title" className={styles.title}>
        Ako ti se sviđa {productName}, probaj i…
      </h2>
      <p className={styles.sub}>Parfemi sa sličnim akordima i notama.</p>
      <div className={styles.grid}>
        {products.map((product) => (
          <ShowcaseCard key={product.id} product={product} onOpen={open} />
        ))}
      </div>
    </section>
  );
}
