"use client";

import type { SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SearchParamsSync from "@/features/shop/components/search-params-sync/search-params-sync";
import FragranticaRating from "@/features/shop/components/fragrantica-rating/fragrantica-rating";
import type { CatalogProduct, Product } from "@/features/shop/types";
import SimilarPerfumes from "@/features/shop/components/similar-perfumes/similar-perfumes";
import ProductReviews from "@/features/reviews/components/product-reviews/product-reviews";
import ReviewsBadge from "@/features/reviews/components/reviews-badge/reviews-badge";
import StockAlertButton from "@/features/stock-alerts/components/stock-alert-button/stock-alert-button";
import RecentlyViewed from "@/features/shop/components/recently-viewed/recently-viewed";
import { brandHref } from "@/features/shop/lib/brands";
import { EMPTY_PRODUCT_REVIEWS, type ProductReviews as ProductReviewsData } from "@/features/reviews/lib/reviews";
import { addToCartAnimated } from "@/features/cart/lib/add-to-cart-animated";
import styles from "./product-details.module.css";
import ScentProfile, { hasScentProfile } from "./scent-profile";
import { useShopSettings } from "@/features/orders/client/use-shop-settings";
import { trackViewItem } from "@/features/analytics/client/track";
import { sanitizeRichText } from "@/lib/rich-text";
import { formatRsd, getPriceBounds } from "@/lib/format";
import { FiHeart } from "react-icons/fi";
import {
  canOptimizeImage,
  getPrimaryImage,
  PRODUCT_IMAGE_FALLBACK,
} from "@/features/shop/lib/product-images";
import { useSessionUser } from "@/features/auth/client/use-session-user";
import {
  addToWishlist,
  isInWishlist,
  removeFromWishlist,
} from "@/features/wishlist/client/wishlist.api";

export default function DetailsClient({
  product,
  similar = [],
  reviews = EMPTY_PRODUCT_REVIEWS,
}: {
  product: Product;
  similar?: CatalogProduct[];
  reviews?: ProductReviewsData;
}) {
  const router = useRouter();
  // ?ml=10 from the URL (filled in by SearchParamsSync in the browser so the page stays static HTML).
  const [mlFromUrl, setMlFromUrl] = useState("");
  // Volume the user picked ("" = not picked -> the default is used).
  const [pickedMl, setSelectedMl] = useState("");
  const handleSearchParams = useCallback((params: URLSearchParams) => {
    setMlFromUrl(params.get("ml") ?? "");
    setSelectedMl("");
  }, []);
  const { isLoggedIn, ready: sessionReady } = useSessionUser();
  const hasProfile = hasScentProfile(product.accords, product.notes, product.wear);
  const shopSettings = useShopSettings();

  // Analytics: perfume view (once per page open).
  useEffect(() => {
    const smallest = product.variants.find((variant) => variant.inStock) ?? product.variants[0];
    trackViewItem({ id: product.id, name: product.name, brand: product.brand, ml: smallest?.ml ?? 0, price: smallest?.priceRsd ?? 0 });
  }, [product.id, product.name, product.brand, product.variants]);

  const defaultMl = useMemo(() => {
    if (mlFromUrl) return mlFromUrl;
    const firstInStock = product.variants.find((v) => v.inStock);
    return firstInStock ? String(firstInStock.ml) : "";
  }, [mlFromUrl, product.variants]);

  const selectedMl = pickedMl || defaultMl;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [wishlistActive, setWishlistActive] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [hiddenImages, setHiddenImages] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const addedTimeoutRef = useRef<number | null>(null);
  const mainImageRef = useRef<HTMLImageElement | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  const primaryProductImage = useMemo(() => getPrimaryImage(product), [product]);

  const gallery = useMemo(
    () =>
      product.images.map((image, index) => ({
        src: image.url,
        label: image.label || `Slika ${index + 1}`,
      })),
    [product.images]
  );

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current !== null) {
        window.clearTimeout(addedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadWishlistState() {
      if (!isLoggedIn) {
        if (alive) setWishlistActive(false);
        return;
      }

      const exists = await isInWishlist(product.id);

      if (alive) {
        setWishlistActive(exists);
      }
    }

    loadWishlistState();

    const onWishlistUpdated = () => {
      loadWishlistState();
    };

    window.addEventListener("wishlist:updated", onWishlistUpdated);

    return () => {
      alive = false;
      window.removeEventListener("wishlist:updated", onWishlistUpdated);
    };
  }, [isLoggedIn, product.id]);

  const selectedVariant = useMemo(
    () =>
      selectedMl
        ? product.variants.find((variant) => String(variant.ml) === String(selectedMl)) ?? null
        : null,
    [product.variants, selectedMl]
  );

  const { min: minPrice, max: maxPrice } = useMemo(
    () => getPriceBounds(product.variants),
    [product.variants]
  );

  const rangeText = useMemo(
    () =>
      minPrice === maxPrice
        ? formatRsd(minPrice)
        : `${formatRsd(minPrice)} - ${formatRsd(maxPrice)}`,
    [maxPrice, minPrice]
  );

  const selectedPriceText = useMemo(
    () => (selectedVariant ? formatRsd(selectedVariant.priceRsd) : rangeText),
    [rangeText, selectedVariant]
  );

  const canAdd = Boolean(selectedVariant && selectedVariant.inStock && qty > 0);

  const hiddenImageSet = useMemo(() => new Set(hiddenImages), [hiddenImages]);
  const visibleGallery = useMemo(
    () => gallery.filter((item) => !hiddenImageSet.has(item.src)),
    [gallery, hiddenImageSet]
  );

  // If an image gets hidden (fails to load), the index falls back to the first one.
  const shownIndex = activeIndex > visibleGallery.length - 1 ? 0 : activeIndex;

  const activeItem = visibleGallery[shownIndex] ?? {
    src: primaryProductImage,
    label: product.name,
  };

  const handleDisplayImageError = useCallback((e: SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;

    img.onerror = null;

    // next/image rewrites src (/_next/image?url=...), so we compare against the encoded URL.
    const alreadyOnPrimary =
      img.src.includes(encodeURIComponent(primaryProductImage)) ||
      img.src.endsWith(primaryProductImage);

    img.srcset = "";
    img.src = alreadyOnPrimary ? PRODUCT_IMAGE_FALLBACK : primaryProductImage;
  }, [primaryProductImage]);

  const onAdd = useCallback(() => {
    if (!selectedVariant) return;

    addToCartAnimated(
      {
        id: product.id,
        name: product.name,
        brand: product.brand,
        imageUrl: primaryProductImage,
        ml: selectedVariant.ml,
        priceRsd: selectedVariant.priceRsd,
        qty,
      },
      addBtnRef.current || mainImageRef.current
    );

    setAdded(true);

    if (addedTimeoutRef.current !== null) {
      window.clearTimeout(addedTimeoutRef.current);
    }

    addedTimeoutRef.current = window.setTimeout(() => {
      setAdded(false);
      addedTimeoutRef.current = null;
    }, 900);
  }, [primaryProductImage, product.brand, product.id, product.name, qty, selectedVariant]);

  const onToggleWishlist = useCallback(async () => {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/shop/${product.id}`)}`);
      return;
    }

    if (wishlistLoading) return;

    setWishlistLoading(true);

    try {
      if (wishlistActive) {
        const ok = await removeFromWishlist(product.id);
        if (ok) {
          setWishlistActive(false);
        }
      } else {
        const ok = await addToWishlist(product.id, {
          preferred_ml: selectedVariant?.ml ?? null,
        });

        if (ok) {
          setWishlistActive(true);
        }
      }
    } finally {
      setWishlistLoading(false);
    }
  }, [isLoggedIn, product.id, router, selectedVariant?.ml, wishlistActive, wishlistLoading]);

  const goPrev = useCallback(() => {
    const count = visibleGallery.length;
    if (count <= 1) return;
    setActiveIndex((prev) => {
      const current = prev > count - 1 ? 0 : prev;
      return current === 0 ? count - 1 : current - 1;
    });
  }, [visibleGallery.length]);

  const goNext = useCallback(() => {
    const count = visibleGallery.length;
    if (count <= 1) return;
    setActiveIndex((prev) => {
      const current = prev > count - 1 ? 0 : prev;
      return current === count - 1 ? 0 : current + 1;
    });
  }, [visibleGallery.length]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      }
    }

    const scrollY = window.scrollY;
    const body = document.body;

    window.addEventListener("keydown", onKeyDown);

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);

      const top = body.style.top;

      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";

      const y = top ? Math.abs(parseInt(top, 10)) : scrollY;
      window.scrollTo(0, y);
    };
  }, [lightboxOpen, goPrev, goNext]);

  return (
    <div className={styles.page}>
      <SearchParamsSync onChange={handleSearchParams} />
      <main className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/shop">Shop</Link>
          <span>/</span>
          <Link href={brandHref(product.brand)}>{product.brand}</Link>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{product.name}</span>
        </div>

        <section className={styles.hero}>
          {visibleGallery.length > 1 && (
          <aside className={styles.galleryRail}>
            {visibleGallery.map((item, i) => (
              <button
                key={item.src}
                type="button"
                className={`${styles.thumbButton} ${shownIndex === i ? styles.thumbButtonActive : ""
                  }`}
                onClick={() => setActiveIndex(i)}
                aria-label={`Prikaži ${item.label}`}
                title={item.label}
              >
                <Image
                  src={item.src}
                  unoptimized={!canOptimizeImage(item.src)}
                  alt={`${product.name} - ${item.label}`}
                  width={96}
                  height={96}
                  sizes="74px"
                  className={styles.thumbImage}
                  onError={() => {
                    setHiddenImages((prev) =>
                      prev.includes(item.src) ? prev : [...prev, item.src]
                    );
                  }}
                />
              </button>
            ))}
          </aside>
          )}

          {/* Single image: no thumbnail column, the main image takes its space too */}
          <div className={`${styles.mainVisual} ${visibleGallery.length > 1 ? "" : styles.mainVisualWide}`}>
            {visibleGallery.length > 1 && (
              <button
                type="button"
                className={`${styles.navArrow} ${styles.navArrowLeft}`}
                onClick={goPrev}
                aria-label="Prethodna slika"
              >
                ‹
              </button>
            )}

            <button
              type="button"
              className={styles.mainImageButton}
              onClick={() => setLightboxOpen(true)}
              aria-label="Povećaj sliku"
            >
              <Image
                ref={mainImageRef}
                src={activeItem.src}
                unoptimized={!canOptimizeImage(activeItem.src)}
                alt={`${product.name} - ${activeItem.label}`}
                width={900}
                height={900}
                sizes="(max-width: 640px) 250px, (max-width: 1200px) 380px, 440px"
                // Largest element on screen (LCP), loaded eagerly instead of lazily
                preload
                className={styles.mainImage}
                onError={handleDisplayImageError}
              />
            </button>

            {visibleGallery.length > 1 && (
              <button
                type="button"
                className={`${styles.navArrow} ${styles.navArrowRight}`}
                onClick={goNext}
                aria-label="Sledeća slika"
              >
                ›
              </button>
            )}
          </div>

          <div className={styles.buyBox}>
            <div className={`${styles.headingBlock} autofit-parent`}>
              <span className={styles.titleBrand}>{product.brand}</span>
              <h1
                className={styles.title}
                title={product.name}
                data-autofit
                data-autofit-max="56"
                data-autofit-min="28"
                suppressHydrationWarning
              >
                {product.name}
              </h1>

              <span className={styles.subline}>
                {[product.concentration, product.gender].filter(Boolean).join(" · ")}
              </span>

              <FragranticaRating rating={product.rating} votes={product.votes} variant="full" />
              <ReviewsBadge summary={reviews.summary} />

              <div className={styles.priceBlock}>
                <div className={styles.priceMain}>
                  {selectedPriceText}
                  {selectedVariant && <span className={styles.priceUnit}>za {selectedVariant.ml} ml</span>}
                </div>
                {!selectedVariant && (
                  <div className={styles.priceRangeHint}>
                    Cena zavisi od izabrane zapremine
                  </div>
                )}
              </div>
            </div>

            <div className={styles.buySection}>
              <div className={styles.selectRow}>
                <span id="variantLabel" className={styles.label}>
                  Zapremina dekanta
                </span>

                <div className={styles.volumeList} role="radiogroup" aria-labelledby="variantLabel">
                  {product.variants.map((v) => {
                    const active = String(v.ml) === String(selectedMl);
                    return (
                      <button
                        key={v.ml}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!v.inStock}
                        onClick={() => setSelectedMl(String(v.ml))}
                        className={`${styles.volumeBtn} ${active ? styles.volumeBtnActive : ""}`}
                      >
                        <strong>{v.ml} ml</strong>
                        <span>{v.inStock ? formatRsd(v.priceRsd) : "nema na stanju"}</span>
                      </button>
                    );
                  })}
                </div>

                <StockAlertButton
                  productId={product.id}
                  variants={product.variants}
                  isLoggedIn={isLoggedIn}
                  sessionReady={sessionReady}
                />
              </div>

              <div className={styles.purchaseRow}>
                <div className={styles.qtyBox}>
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Smanji količinu"
                  >
                    −
                  </button>

                  <div className={styles.qtyValue}>{qty}</div>

                  <button
                    type="button"
                    className={styles.qtyBtn}
                    onClick={() => setQty((q) => q + 1)}
                    aria-label="Povećaj količinu"
                  >
                    +
                  </button>
                </div>

                <button
                  ref={addBtnRef}
                  type="button"
                  onClick={onAdd}
                  disabled={!canAdd}
                  className={canAdd ? styles.addBtn : styles.addBtnDisabled}
                >
                  {added ? "Dodato ✓" : "Dodaj u korpu"}
                </button>
              </div>

              <button
                type="button"
                onClick={onToggleWishlist}
                disabled={wishlistLoading}
                aria-pressed={wishlistActive}
                className={`${styles.wishlistBtn} ${wishlistActive ? styles.wishlistBtnActive : ""
                  }`}
              >
                <span className={styles.wishlistBtnInner}>
                  <FiHeart
                    className={`${styles.wishlistIcon} ${wishlistActive ? styles.wishlistIconActive : ""
                      }`}
                    aria-hidden="true"
                  />

                  <span>
                    {wishlistLoading
                      ? "Sačekaj..."
                      : wishlistActive
                        ? "Sačuvano u listi želja"
                        : "Sačuvaj u listu želja"}
                  </span>
                </span>
              </button>
            </div>

            <div className={styles.detailsStack}>
              <section className={styles.infoPanel}>
                <div className={styles.sectionKicker}>Detalji proizvoda</div>

                <div className={styles.metaGridPremium}>
                  <div className={styles.metaCard}>
                    <span className={styles.metaCardLabel}>Brend</span>
                    <span className={styles.metaCardValue}>{product.brand}</span>
                  </div>

                  <div className={styles.metaCard}>
                    <span className={styles.metaCardLabel}>Pol</span>
                    <span className={styles.metaCardValue}>
                      {product.gender}
                    </span>
                  </div>

                  <div className={styles.metaCard}>
                    <span className={styles.metaCardLabel}>Koncentracija</span>
                    <span className={styles.metaCardValue}>
                      {product.concentration}
                    </span>
                  </div>

                  <div className={styles.metaCard}>
                    <span className={styles.metaCardLabel}>Zapremine</span>
                    <span className={styles.metaCardValue}>
                      {product.variants.map((variant) => variant.ml).join(" · ")} ml
                    </span>
                  </div>
                </div>
              </section>

              <section className={styles.servicePanel}>
                <div className={styles.sectionKicker}>Kupovina bez brige</div>

                <div className={styles.serviceGrid}>
                  <div
                    className={`${styles.serviceCard} ${styles.serviceCardPrimary}`}
                  >
                    <span className={styles.serviceCardTitle}>Dostava</span>
                    <span className={styles.serviceCardText}>
                      1–3 radna dana
                      {shopSettings.freeShippingFromRsd && shopSettings.shippingRsd > 0
                        ? ` · besplatno od ${formatRsd(shopSettings.freeShippingFromRsd)}`
                        : ""}
                    </span>
                  </div>

                  <div className={styles.serviceCard}>
                    <span className={styles.serviceCardTitle}>Plaćanje</span>
                    <span className={styles.serviceCardText}>
                      Pouzećem ili uplatom
                    </span>
                  </div>

                  <div className={styles.serviceCard}>
                    <span className={styles.serviceCardTitle}>Pakovanje</span>
                    <span className={styles.serviceCardText}>
                      Pažljivo pripremljen dekant
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {(hasProfile || product.description) && (
            <section className={styles.descriptionSection}>
              <div className={styles.descriptionIntro}>
                <h2 className={styles.descriptionTitle}>Mirisni profil</h2>
              </div>

              {hasProfile && (
                <ScentProfile accords={product.accords} notes={product.notes} wear={product.wear} />
              )}

              {product.description && (
                <div className={`${styles.descriptionCard} ${hasProfile ? styles.descriptionCardAfter : ""}`}>
                  <div
                    className={styles.descriptionText}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichText(product.description),
                    }}
                  />
                </div>
              )}
            </section>
          )}
        </section>

        <ProductReviews productId={product.id} productName={product.name} initial={reviews} />

        <SimilarPerfumes productName={product.name} products={similar} />

        <RecentlyViewed currentId={product.id} />
      </main>

      {lightboxOpen && (
        <div className={styles.lightboxOverlay} onMouseDown={closeLightbox}>
          <div className={styles.lightboxInner} onMouseDown={closeLightbox}>
            <button
              type="button"
              className={styles.lightboxClose}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={closeLightbox}
              aria-label="Zatvori"
            >
              ✕
            </button>

            {visibleGallery.length > 1 && (
              <button
                type="button"
                className={`${styles.lightboxArrow} ${styles.lightboxArrowLeft}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={goPrev}
                aria-label="Prethodna slika"
              >
                ‹
              </button>
            )}

            <Image
              src={activeItem.src}
              unoptimized={!canOptimizeImage(activeItem.src)}
              alt={`${product.name} - ${activeItem.label}`}
              width={1200}
              height={1200}
              sizes="100vw"
              className={styles.lightboxImage}
              onMouseDown={(e) => e.stopPropagation()}
              onError={handleDisplayImageError}
            />

            {visibleGallery.length > 1 && (
              <button
                type="button"
                className={`${styles.lightboxArrow} ${styles.lightboxArrowRight}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={goNext}
                aria-label="Sledeća slika"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
