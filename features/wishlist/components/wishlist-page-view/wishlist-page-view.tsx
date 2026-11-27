"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiHeart, FiTrash2 } from "react-icons/fi";
import styles from "./wishlist-page-view.module.css";
import { fetchCatalog } from "@/features/shop/client/catalog.api";
import {
  canOptimizeImage,
  getPrimaryImage,
  PRODUCT_IMAGE_FALLBACK,
} from "@/features/shop/lib/product-images";
import type { CatalogProduct as WishlistProduct } from "@/features/shop/types";
import {
  readWishlist,
  removeFromWishlist,
} from "@/features/wishlist/client/wishlist.api";
import type { WishlistItem } from "@/features/wishlist/types";
import { useSessionUser } from "@/features/auth/client/use-session-user";
import StockAlertButton from "@/features/stock-alerts/components/stock-alert-button/stock-alert-button";
import { formatRsd as formatPrice, getPriceBounds } from "@/lib/format";

function getPriceRange(variants: WishlistProduct["variants"]) {
  return variants.length ? getPriceBounds(variants) : null;
}

export default function WishlistPageView() {
  const { isLoggedIn, ready: sessionReady } = useSessionUser();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistReady, setWishlistReady] = useState(false);

  const hasLoadedProductsRef = useRef(false);

  const syncWishlist = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    }

    try {
      const items = await readWishlist();
      setWishlistItems(items);
    } catch (error) {
      console.error("Greška pri sinhronizaciji wishlist-a:", error);
      setWishlistItems([]);
    } finally {
      setWishlistReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function runSync(options?: { silent?: boolean }) {
      try {
        await syncWishlist(options);
      } finally {
        if (active && !options?.silent && !hasLoadedProductsRef.current) {
          setLoading(true);
        }
      }
    }

    void runSync();

    const handleWishlistUpdated = () => {
      void runSync({ silent: true });
    };

    const handleFocus = () => {
      void runSync({ silent: true });
    };

    window.addEventListener("wishlist:updated", handleWishlistUpdated);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("wishlist:updated", handleWishlistUpdated);
      window.removeEventListener("focus", handleFocus);
    };
  }, [syncWishlist]);

  useEffect(() => {
    let cancelled = false;

    async function loadWishlistProducts() {
      if (!wishlistReady) {
        return;
      }

      const ids = wishlistItems.map((item) => item.product_id);

      if (!ids.length) {
        setProducts([]);
        setLoading(false);
        hasLoadedProductsRef.current = false;
        return;
      }

      if (!hasLoadedProductsRef.current) {
        setLoading(true);
      }

      // Products come from the cached catalog (/api/catalog), not straight from the database.
      const catalog = await fetchCatalog();

      if (cancelled) return;

      const productMap = new Map(catalog.map((product) => [product.id, product]));
      const ordered = ids
        .map((id) => productMap.get(id))
        .filter(Boolean) as WishlistProduct[];

      setProducts(ordered);
      setLoading(false);
      hasLoadedProductsRef.current = true;
    }

    void loadWishlistProducts();

    return () => {
      cancelled = true;
    };
  }, [wishlistItems, wishlistReady]);

  const wishlistMetaByProductId = useMemo(
    () => new Map(wishlistItems.map((item) => [item.product_id, item])),
    [wishlistItems]
  );

  const handleRemove = useCallback(async (productId: string) => {
    await removeFromWishlist(productId);
    const nextWishlistItems = await readWishlist();
    setWishlistItems(nextWishlistItems);
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Wishlist</span>
            <h1 className={styles.title}>Omiljeni proizvodi</h1>
            <p className={styles.subtitle}>
              Sačuvaj proizvode koji ti se sviđaju i vrati im se kasnije.
            </p>
          </div>

          <div className={styles.heroMeta}>
            <span className={styles.countPill}>
              {wishlistItems.length} {wishlistItems.length === 1 ? "proizvod" : "proizvoda"}
            </span>
          </div>
        </section>

        {loading || !wishlistReady ? (
          <section className={styles.stateCard}>
            <div className={styles.stateTitle}>Učitavanje wishlist-a...</div>
          </section>
        ) : !products.length ? (
          <section className={styles.emptyCard}>
            <div className={styles.emptyIcon}>
              <FiHeart />
            </div>

            <h2 className={styles.emptyTitle}>Tvoja wishlist je prazna</h2>
            <p className={styles.emptyText}>
              Dodaj omiljene parfeme kako bi im se kasnije brzo vratio.
            </p>

            <Link href="/shop" className={styles.primaryBtn}>
              Idi u shop
            </Link>
          </section>
        ) : (
          <section className={styles.grid}>
            {products.map((product) => {
              const priceRange = getPriceRange(product.variants);
              const hasStock = product.variants.some((variant) => variant.inStock);
              const meta = wishlistMetaByProductId.get(product.id);

              return (
                <article key={product.id} className={styles.card}>
                  <Link href={`/shop/${product.id}`} className={styles.imageLink}>
                    <div className={styles.imageWrap}>
                      <Image
                        src={getPrimaryImage(product)}
                        unoptimized={!canOptimizeImage(getPrimaryImage(product))}
                        alt={product.name}
                        width={600}
                        height={600}
                        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 360px"
                        className={styles.image}
                        onError={(event) => {
                          event.currentTarget.srcset = "";
                          event.currentTarget.src = PRODUCT_IMAGE_FALLBACK;
                        }}
                      />
                    </div>
                  </Link>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <div>
                        <div className={styles.brand}>{product.brand}</div>

                        <Link href={`/shop/${product.id}`} className={styles.name}>
                          {product.name}
                        </Link>
                      </div>

                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label={`Ukloni ${product.name} iz wishlist-a`}
                        onClick={() => void handleRemove(product.id)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>

                    <div className={styles.cardMeta}>
                      <span className={styles.price}>
                        {priceRange
                          ? priceRange.min === priceRange.max
                            ? formatPrice(priceRange.min)
                            : `${formatPrice(priceRange.min)} - ${formatPrice(priceRange.max)}`
                          : "Cena uskoro"}
                      </span>

                      <span
                        className={`${styles.stock} ${hasStock ? styles.inStock : styles.outOfStock}`}
                      >
                        {hasStock ? "Na stanju" : "Nema na stanju"}
                      </span>
                    </div>

                    {meta?.created_at ? (
                      <div className={styles.savedAt}>
                        Dodato: {new Date(meta.created_at).toLocaleDateString("sr-RS")}
                      </div>
                    ) : null}

                    {!hasStock && (
                      <StockAlertButton
                        productId={product.id}
                        variants={product.variants}
                        isLoggedIn={isLoggedIn}
                        sessionReady={sessionReady}
                        compact
                      />
                    )}

                    <div className={styles.actions}>
                      <Link href={`/shop/${product.id}`} className={styles.secondaryBtn}>
                        Pogledaj proizvod
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
