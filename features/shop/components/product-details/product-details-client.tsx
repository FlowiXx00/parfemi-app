"use client";

import type { SyntheticEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product } from "@/features/shop/types";
import { addToCart } from "@/features/cart/client/cart.storage";
import { flyToCart } from "@/features/cart/lib/fly-to-cart";
import styles from "./product-details.module.css";
import { sanitizeRichText } from "@/shared/lib/rich-text";
import ProductReviews from "@/features/shop/components/product-reviews/product-reviews";
import { FiHeart } from "react-icons/fi";
import {
  getProductGallery,
  getPrimaryProductImage,
} from "@/features/shop/lib/product-gallery";
import {
  addToWishlist,
  isInWishlist,
  removeFromWishlist,
} from "@/features/wishlist/client/wishlist.api";

function formatRsd(n: number) {
  return new Intl.NumberFormat("sr-RS").format(n) + " rsd";
}

const FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="100%" height="100%" fill="var(--surface-2)"/>
    <text
      x="50%"
      y="50%"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="var(--text-muted)"
      font-family="Arial, sans-serif"
      font-size="32"
    >
      No image
    </text>
  </svg>
`)}`;

export default function DetailsClient({
  product,
  mlFromUrl,
  isLoggedIn,
}: {
  product: Product;
  mlFromUrl: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();

  const defaultMl = useMemo(() => {
    if (mlFromUrl) return mlFromUrl;
    const firstInStock = product.variants.find((v) => v.inStock);
    return firstInStock ? String(firstInStock.ml) : "";
  }, [mlFromUrl, product.variants]);

  const [selectedMl, setSelectedMl] = useState<string>(defaultMl);
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

  const primaryProductImage = useMemo(
    () => getPrimaryProductImage(product.id),
    [product.id]
  );

  const gallery = useMemo(() => getProductGallery(product.id), [product.id]);

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current !== null) {
        window.clearTimeout(addedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedMl(defaultMl);
  }, [defaultMl]);

  useEffect(() => {
    setHiddenImages([]);
    setActiveIndex(0);
    setLightboxOpen(false);
    setQty(1);
    setAdded(false);
  }, [product.id]);

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

  const { minPrice, maxPrice } = useMemo(() => {
    const prices = product.variants.map((variant) => variant.priceRsd);

    if (!prices.length) {
      return { minPrice: 0, maxPrice: 0 };
    }

    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    };
  }, [product.variants]);

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

  useEffect(() => {
    if (visibleGallery.length === 0) return;
    if (activeIndex > visibleGallery.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, visibleGallery.length]);

  const activeItem = visibleGallery[activeIndex] ?? {
    src: primaryProductImage,
    label: product.name,
  };

  const handleDisplayImageError = useCallback((e: SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;

    img.onerror = null;

    const alreadyOnPrimary = img.src.includes(
      `/perfumes/${product.id}/parfem.png`
    );

    if (alreadyOnPrimary) {
      img.src = FALLBACK_IMAGE;
      return;
    }

    img.src = primaryProductImage;
  }, [primaryProductImage, product.id]);

  const onAdd = useCallback(() => {
    if (!selectedVariant) return;

    addToCart({
      id: product.id,
      name: product.name,
      brand: product.brand,
      imageUrl: primaryProductImage,
      ml: selectedVariant.ml,
      priceRsd: selectedVariant.priceRsd,
      qty,
    });

    setAdded(true);

    if (addedTimeoutRef.current !== null) {
      window.clearTimeout(addedTimeoutRef.current);
    }

    addedTimeoutRef.current = window.setTimeout(() => {
      setAdded(false);
      addedTimeoutRef.current = null;
    }, 900);

    const cartIcon = document.querySelector(
      "[data-cart-icon]"
    ) as HTMLElement | null;

    const sourceEl = addBtnRef.current || mainImageRef.current;

    if (sourceEl && cartIcon) {
      flyToCart(sourceEl, cartIcon);

      setTimeout(() => {
        window.dispatchEvent(new Event("cart:open"));
      }, 420);
    } else {
      window.dispatchEvent(new Event("cart:open"));
    }
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
    if (visibleGallery.length <= 1) return;
    setActiveIndex((prev) =>
      prev === 0 ? visibleGallery.length - 1 : prev - 1
    );
  }, [visibleGallery.length]);

  const goNext = useCallback(() => {
    if (visibleGallery.length <= 1) return;
    setActiveIndex((prev) =>
      prev === visibleGallery.length - 1 ? 0 : prev + 1
    );
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
      <main className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/shop">Home</Link>
          <span>/</span>
          <span>Pakovanje</span>
          <span>/</span>
          <span>Komercijalno</span>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{product.name}</span>
        </div>

        <section className={styles.hero}>
          <aside className={styles.galleryRail}>
            {visibleGallery.map((item, i) => (
              <button
                key={item.src}
                type="button"
                className={`${styles.thumbButton} ${activeIndex === i ? styles.thumbButtonActive : ""
                  }`}
                onClick={() => setActiveIndex(i)}
                aria-label={`Prikaži ${item.label}`}
                title={item.label}
              >
                <Image
                  src={item.src}
                  alt={`${product.name} - ${item.label}`}
                  width={96}
                  height={96}
                  unoptimized
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

          <div className={styles.mainVisual}>
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
                alt={`${product.name} - ${activeItem.label}`}
                width={900}
                height={900}
                unoptimized
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

              <div className={styles.priceBlock}>
                <div className={styles.priceMain}>{selectedPriceText}</div>
                {!selectedVariant && (
                  <div className={styles.priceRangeHint}>
                    Cena zavisi od izabrane zapremine
                  </div>
                )}
              </div>
            </div>

            <div className={styles.buySection}>
              <div className={styles.selectRow}>
                <label htmlFor="variantSelect" className={styles.label}>
                  Zapremina
                </label>

                <select
                  id="variantSelect"
                  value={selectedMl}
                  onChange={(e) => setSelectedMl(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Izaberi zapreminu</option>
                  {product.variants.map((v) => (
                    <option
                      key={v.ml}
                      value={String(v.ml)}
                      disabled={!v.inStock}
                    >
                      {v.ml}ml {v.inStock ? "" : "(nema na stanju)"}
                    </option>
                  ))}
                </select>
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
                    <span className={styles.metaCardLabel}>Kategorija</span>
                    <span className={styles.metaCardValue}>Komercijalno</span>
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
                      1–2 radna dana
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

          <section className={styles.descriptionSection}>
            <div className={styles.descriptionIntro}>
              <h2 className={styles.descriptionTitle}>O parfemu</h2>
            </div>

            <div className={styles.descriptionCard}>
              {product.description ? (
                <div
                  className={styles.descriptionText}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichText(product.description),
                  }}
                />
              ) : (
                <p className={styles.descriptionEmpty}>
                  Opis će uskoro biti dodat.
                </p>
              )}
            </div>
          </section>
        </section>

        <ProductReviews
          productId={product.id}
          productName={product.name}
          isLoggedIn={isLoggedIn}
        />
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
              alt={`${product.name} - ${activeItem.label}`}
              width={1200}
              height={1200}
              unoptimized
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
