"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import ShowcaseCard from "@/features/shop/components/showroom/showcase-card";
import type { CatalogProduct } from "@/features/shop/types";
import styles from "./brand-page.module.css";

/** Brand page grid: the same cards as the shop; a click opens the perfume page. */
export default function BrandProducts({ products }: { products: CatalogProduct[] }) {
  const router = useRouter();
  const open = useCallback((id: string) => router.push(`/shop/${encodeURIComponent(id)}`), [router]);

  return (
    <div className={styles.grid}>
      {products.map((product) => (
        <ShowcaseCard key={product.id} product={product} onOpen={open} />
      ))}
    </div>
  );
}
