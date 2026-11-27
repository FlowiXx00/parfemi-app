"use client";

import { useEffect, useState } from "react";
import type { ProductDetails } from "@/features/shop/types";

/** Details downloaded once per perfume per visit (quick view opened again = no new request). */
const cache = new Map<string, Promise<ProductDetails | null>>();

export function fetchProductDetails(productId: string) {
  let promise = cache.get(productId);
  if (!promise) {
    promise = fetch(`/api/catalog/${encodeURIComponent(productId)}`)
      .then((response) => (response.ok ? (response.json() as Promise<ProductDetails>) : null))
      .catch(() => null)
      .then((details) => {
        if (!details) cache.delete(productId); // try again next time
        return details;
      });
    cache.set(productId, promise);
  }
  return promise;
}

/** Notes etc. for one perfume (null while loading or if they couldn't be loaded). */
export function useProductDetails(productId: string) {
  const [result, setResult] = useState<{ id: string; details: ProductDetails | null; done: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    void fetchProductDetails(productId).then((details) => {
      if (active) setResult({ id: productId, details, done: true });
    });
    return () => {
      active = false;
    };
  }, [productId]);

  const current = result?.id === productId ? result : null;
  return { details: current?.details ?? null, loading: !current?.done };
}
