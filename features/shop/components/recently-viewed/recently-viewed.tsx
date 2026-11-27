"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCatalog } from "@/features/shop/client/catalog.api";
import ShowcaseCard from "@/features/shop/components/showroom/showcase-card";
import {
  parseRecentlyViewed,
  pushRecentlyViewed,
  RECENTLY_VIEWED_KEY,
} from "@/features/shop/lib/recently-viewed";
import type { CatalogProduct } from "@/features/shop/types";
import styles from "./recently-viewed.module.css";

const SHOWN = 4;

/**
 * Below the product page: perfumes the visitor looked at before (from their browser only).
 * Opening this page also records it. Renders nothing for a first visit.
 */
export default function RecentlyViewed({ currentId }: { currentId: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const open = useCallback((id: string) => router.push(`/shop/${encodeURIComponent(id)}`), [router]);

  useEffect(() => {
    let previous: string[] = [];
    try {
      previous = parseRecentlyViewed(window.localStorage.getItem(RECENTLY_VIEWED_KEY));
      window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(pushRecentlyViewed(previous, currentId)));
    } catch {
      /* storage not available (private mode) */
    }

    const ids = previous.filter((id) => id !== currentId);
    if (!ids.length) return;

    let active = true;
    // Cards come from the cached catalog (shared with search and the shop, downloaded once per visit).
    void fetchCatalog().then((catalog) => {
      if (!active) return;
      const byId = new Map(catalog.map((product) => [product.id, product]));
      setProducts(ids.map((id) => byId.get(id)).filter((product) => product !== undefined).slice(0, SHOWN));
    });
    return () => {
      active = false;
    };
  }, [currentId]);

  if (!products.length) return null;

  return (
    <section className={styles.section} aria-labelledby="recently-viewed-title">
      <span className={styles.kicker}>Nedavno pregledano</span>
      <h2 id="recently-viewed-title" className={styles.title}>
        Mirisi koje si već gledao/la
      </h2>
      <div className={styles.grid}>
        {products.map((product) => (
          <ShowcaseCard key={product.id} product={product} onOpen={open} />
        ))}
      </div>
    </section>
  );
}
