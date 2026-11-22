"use client";

import { useEffect, useState } from "react";
import type { ShopProduct } from "@/features/shop/types";

/**
 * The browser downloads the catalog only once per visit (shared by the shop,
 * header search, quiz and wishlist) from the cached /api/catalog route.
 */
let catalogPromise: Promise<ShopProduct[]> | null = null;

export function fetchCatalog(): Promise<ShopProduct[]> {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/catalog")
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((data: { products?: ShopProduct[] }) =>
        Array.isArray(data.products) ? data.products : []
      )
      .catch((error) => {
        console.error("Greška pri učitavanju kataloga:", error);
        catalogPromise = null;
        return [];
      });
  }

  return catalogPromise;
}

/** Loads the catalog only once `enabled` becomes true (e.g. when search is opened). */
export function useCatalog(enabled: boolean) {
  const [products, setProducts] = useState<ShopProduct[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    void fetchCatalog().then((list) => {
      if (active) setProducts(list);
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return products;
}
