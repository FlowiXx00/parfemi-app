"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import {
  PiCaretLeft,
  PiCaretRight,
  PiFire,
  PiFlowerTulip,
  PiHeart,
  PiHeartFill,
  PiLeaf,
  PiMoonStars,
  PiSnowflake,
  PiStarFill,
  PiSun,
} from "react-icons/pi";
import { addToCartAnimated } from "@/features/cart/lib/add-to-cart-animated";
import { useBottleImage } from "@/features/shop/client/use-bottle-image";
import { useProductDetails } from "@/features/shop/client/product-details.api";
import { cutoutFor } from "@/features/shop/lib/cutout";
import { getPrimaryImage, PRODUCT_IMAGE_FALLBACK } from "@/features/shop/lib/product-images";
import { accordColor, DAY_NIGHT, SEASONS, type Notes, type WearKey } from "@/features/shop/lib/scent";
import type { ShopProduct } from "@/features/shop/types";

const EMPTY_NOTES: Notes = { top: [], middle: [], base: [] };
import { useWishlistToggle } from "@/features/wishlist/client/use-wishlist-toggle";
import { trackViewItem } from "@/features/analytics/client/track";
import { formatRsd, getPriceBounds } from "@/lib/format";
import DecantVial from "./decant-vial";
import EmptyBottle from "./empty-bottle";
import FragranticaRating from "../fragrantica-rating/fragrantica-rating";
import styles from "./showcase-modal.module.css";

/** Dust particles in the light beam (fixed positions so they don't change on every render). */
const DUST = Array.from({ length: 16 }, (_, i) => ({
  left: 30 + ((i * 37) % 40),
  delay: (i * 0.73) % 6,
  duration: 6 + ((i * 1.9) % 5),
  size: 2 + (i % 3),
}));

const CLOSE_ANIMATION_MS = 260;
/** When the lamp turns on, the pipette fills itself with the smallest volume. */
const AUTO_FILL_DELAY_MS = 1250;

const WEAR_ICONS: Record<WearKey, typeof PiSun> = {
  spring: PiFlowerTulip,
  summer: PiSun,
  fall: PiLeaf,
  winter: PiSnowflake,
  day: PiSun,
  night: PiMoonStars,
};

type WishlistProps = {
  likedIds: Set<string>;
  isLoggedIn: boolean;
  loginHref: string;
  onWishlistChange: (productId: string, nextLiked: boolean) => void;
};

/**
 * Quick view: the frame (backdrop, close, arrows) stays, while the stage with the bottle and the panel
 * is replaced when switching perfumes (the lamp turns on again).
 */
export default function ShowcaseModal({
  products,
  productId,
  returnFocusTo,
  onNavigate,
  onClose,
  wishlist,
}: {
  products: ShopProduct[];
  productId: string;
  returnFocusTo: HTMLElement | null;
  onNavigate: (productId: string) => void;
  onClose: () => void;
  wishlist: WishlistProps;
}) {
  const [closing, setClosing] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const index = products.findIndex((product) => product.id === productId);
  const product = products[index] ?? null;
  const canBrowse = products.length > 1;

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, CLOSE_ANIMATION_MS);
  }, [onClose]);

  const go = useCallback(
    (step: 1 | -1) => {
      if (!canBrowse || index < 0) return;
      const next = products[(index + step + products.length) % products.length];
      if (next) onNavigate(next.id);
    },
    [canBrowse, index, onNavigate, products]
  );

  // Scroll is locked while the quick view is open; focus goes to "close" and back to the card afterwards.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusTo?.focus({ preventScroll: true });
    };
  }, [returnFocusTo]);

  // Keyboard: Escape closes, left/right arrows switch perfumes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      // Arrow keys in text inputs and in the volume picker don't switch perfumes.
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[role="radiogroup"], input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, go]);

  if (!product) return null;

  return createPortal(
    <div
      className={`${styles.backdrop} ${closing ? styles.closing : ""}`}
      onMouseDown={(event) => {
        // Clicking the empty backdrop (not the dialog) closes the quick view.
        if (event.target === event.currentTarget || event.target === event.currentTarget.firstElementChild) {
          close();
        }
      }}
    >
      {/* Dialog centered when it fits, otherwise the backdrop scrolls */}
      <div className={styles.stack}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="showcase-title">
        <button ref={closeBtnRef} type="button" className={styles.closeBtn} onClick={close} aria-label="Zatvori">
          <FiX />
        </button>

        {canBrowse && (
          <>
            <button type="button" className={`${styles.navBtn} ${styles.navPrev}`} onClick={() => go(-1)} aria-label="Prethodni parfem">
              <PiCaretLeft />
            </button>
            <button type="button" className={`${styles.navBtn} ${styles.navNext}`} onClick={() => go(1)} aria-label="Sledeći parfem">
              <PiCaretRight />
            </button>
            <span className={styles.counter} aria-live="polite">
              {index + 1} / {products.length}
            </span>
          </>
        )}

        <ShowcaseStage key={product.id} product={product} wishlist={wishlist} onAdded={close} />
      </div>
      </div>
    </div>,
    document.body
  );
}

/** Stage (lamp, bottle, pedestal) + panel (accords, seasons, ml, pipette, cart). */
function ShowcaseStage({
  product,
  wishlist,
  onAdded,
}: {
  product: ShopProduct;
  wishlist: WishlistProps;
  onAdded: () => void;
}) {
  const [cutoutBroken, setCutoutBroken] = useState(false);
  const precomputed = cutoutBroken ? null : cutoutFor(product, 828);
  const bottle = useBottleImage(getPrimaryImage(product), 828, true, precomputed);
  // Notes aren't in the light catalog: loaded for this perfume when the quick view opens.
  const { details, loading: detailsLoading } = useProductDetails(product.id);
  const notes = details?.notes ?? EMPTY_NOTES;

  // Analytics: perfume viewed in the quick view (the stage is recreated for each perfume).
  useEffect(() => {
    const smallest = product.variants.find((variant) => variant.inStock) ?? product.variants[0];
    trackViewItem({ id: product.id, name: product.name, brand: product.brand, ml: smallest?.ml ?? 0, price: smallest?.priceRsd ?? 0 });
  }, [product.id, product.name, product.brand, product.variants]);
  const variants = useMemo(() => [...product.variants].sort((a, b) => a.ml - b.ml), [product.variants]);
  const maxMl = Math.max(1, ...variants.map((variant) => variant.ml));
  const { min: minPrice } = getPriceBounds(variants);

  // The smallest available volume is selected right away (price on the pedestal without "from" from the
  // first moment). The pipette fills only once the lamp is on (vialMl lags by AUTO_FILL_DELAY_MS).
  const [selectedMl, setSelectedMl] = useState<number | null>(
    () => variants.find((variant) => variant.inStock)?.ml ?? null
  );
  const [vialMl, setVialMl] = useState<number | null>(null);
  const [dripKey, setDripKey] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const selectedRef = useRef<number | null>(null);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  const selectedVariant = variants.find((variant) => variant.ml === selectedMl) ?? null;
  const liked = wishlist.isLoggedIn && wishlist.likedIds.has(product.id);

  const { toggle: toggleWishlist, loading: wishlistLoading } = useWishlistToggle({
    productId: product.id,
    liked,
    isLoggedIn: wishlist.isLoggedIn,
    loginHref: wishlist.loginHref,
    preferredMl: selectedMl,
    onChange: wishlist.onWishlistChange,
  });

  const chooseMl = useCallback((ml: number) => {
    if (selectedRef.current === ml) return;
    selectedRef.current = ml;
    setSelectedMl(ml);
    setVialMl(ml);
    setDripKey((key) => key + 1);
  }, []);

  // When the lamp turns on, the pipette fills with the selected volume (unless the customer already
  // clicked one meanwhile).
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (selectedRef.current !== null) return;
      const ml = variants.find((variant) => variant.inStock)?.ml;
      if (ml === undefined) return;
      selectedRef.current = ml;
      setVialMl(ml);
      setDripKey((key) => key + 1);
    }, AUTO_FILL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [variants]);

  const addToCart = () => {
    if (!selectedVariant || !selectedVariant.inStock) return;

    addToCartAnimated(
      {
        id: product.id,
        name: product.name,
        brand: product.brand,
        imageUrl: getPrimaryImage(product),
        ml: selectedVariant.ml,
        priceRsd: selectedVariant.priceRsd,
        qty: 1,
      },
      addBtnRef.current
    );
    onAdded();
  };

  const accords = product.accords.slice(0, 4);
  const hasWear = Object.keys(product.wear).length > 0;

  // One main note from each layer (the full pyramid is on the product page).
  const keyNotes = [
    { label: "Otvaranje", list: notes.top },
    { label: "Srce", list: notes.middle },
    { label: "Baza", list: notes.base },
  ]
    .filter((layer) => layer.list.length > 0);
  const hiddenNotes = keyNotes.reduce((sum, layer) => sum + Math.max(0, layer.list.length - 1), 0);

  return (
    <>
      {/* ---------- Scena ---------- */}
      <div className={styles.scene} aria-hidden="true">
        <span className={styles.lamp} />
        <span className={styles.beam} />
        <span className={styles.dust}>
          {DUST.map((particle, i) => (
            <span
              key={i}
              style={{
                left: `${particle.left}%`,
                width: particle.size,
                height: particle.size,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
              }}
            />
          ))}
        </span>

        <span className={styles.bottleWrap}>
          {bottle.ready && bottle.src === PRODUCT_IMAGE_FALLBACK ? (
            <EmptyBottle className={styles.bottleEmpty} />
          ) : bottle.ready && bottle.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bottle.src}
              alt=""
              className={styles.bottle}
              draggable={false}
              decoding="async"
              onError={() => precomputed && setCutoutBroken(true)}
            />
          ) : null}
        </span>

        <span className={styles.floorGlow} />
        <span className={styles.pedestal}>
          <span className={styles.pedestalTop} />
          <span className={styles.pedestalFront}>
            {selectedVariant ? formatRsd(selectedVariant.priceRsd) : `od ${formatRsd(minPrice)}`}
          </span>
        </span>
      </div>

      {/* ---------- Panel ---------- */}
      <div className={styles.panel}>
        <div className={styles.heading}>
          <div className={styles.headingText}>
            <span className={styles.brandRow}>
              <span className={styles.brand}>{product.brand}</span>
              {product.isBestseller && (
                <span className={`${styles.tag} ${styles.tagHot}`}>
                  <PiFire aria-hidden="true" /> Najprodavanije
                </span>
              )}
              {product.isFeatured && (
                <span className={`${styles.tag} ${styles.tagFeatured}`}>
                  <PiStarFill aria-hidden="true" /> Preporuka
                </span>
              )}
            </span>
            <h2 id="showcase-title" className={styles.title}>
              {product.name}
            </h2>
            <span className={styles.sub}>
              {product.concentration} · {product.gender}
            </span>
            <FragranticaRating
              rating={product.rating}
              votes={product.votes}
              variant="full"
              className={styles.rating}
            />
          </div>

          <button
            type="button"
            className={`${styles.heartBtn} ${liked ? styles.heartBtnActive : ""}`}
            onClick={toggleWishlist}
            disabled={wishlistLoading}
            aria-pressed={liked}
            aria-label={liked ? "Ukloni iz liste želja" : "Dodaj u listu želja"}
          >
            {liked ? <PiHeartFill /> : <PiHeart />}
          </button>
        </div>

        {(accords.length > 0 || hasWear || keyNotes.length > 0 || detailsLoading) && (
          <div className={styles.scent}>
            {accords.length > 0 && (
              <ul className={styles.accords} aria-label="Glavni akordi">
                {accords.map((accord, i) => (
                  <li key={accord.name}>
                    <span className={styles.accordName}>{accord.name}</span>
                    <span className={styles.accordTrack}>
                      <span
                        className={styles.accordBar}
                        style={{
                          width: `${accord.strength}%`,
                          background: accordColor(accord.name),
                          animationDelay: `${450 + i * 90}ms`,
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {detailsLoading && keyNotes.length === 0 && (
              <div className={styles.keyNotes} aria-hidden="true">
                {["Otvaranje", "Srce", "Baza"].map((label) => (
                  <span key={label} className={`${styles.keyNote} ${styles.keyNoteLoading}`}>
                    <small>{label}</small>
                    <span className={styles.keyNoteList}>…</span>
                  </span>
                ))}
              </div>
            )}

            {keyNotes.length > 0 && (
              <div className={styles.keyNotes} aria-label="Note">
                {keyNotes.map((layer) => (
                  <span key={layer.label} className={styles.keyNote}>
                    <small>{layer.label}</small>
                    <span className={notesOpen ? styles.keyNoteListOpen : styles.keyNoteList}>
                      {notesOpen ? layer.list.join(", ") : layer.list[0]}
                      {!notesOpen && layer.list.length > 1 && (
                        <em className={styles.keyNoteMore}> +{layer.list.length - 1}</em>
                      )}
                    </span>
                  </span>
                ))}

                {hiddenNotes > 0 && (
                  <button
                    type="button"
                    className={styles.notesToggle}
                    onClick={() => setNotesOpen((open) => !open)}
                    aria-expanded={notesOpen}
                  >
                    {notesOpen ? "Prikaži manje" : `Prikaži sve note (${hiddenNotes} još)`}
                  </button>
                )}
              </div>
            )}

            {hasWear && (
              <div className={styles.wear} aria-label="Kada nositi">
                {[...SEASONS, ...DAY_NIGHT].map(({ key, label }) => {
                  const value = product.wear[key] ?? 0;
                  const Icon = WEAR_ICONS[key];
                  return (
                    <span
                      key={key}
                      className={`${styles.wearItem} ${value >= 60 ? styles.wearStrong : ""}`}
                      style={{ opacity: 0.35 + (value / 100) * 0.65 }}
                      title={`${label}: ${value}%`}
                    >
                      <Icon aria-hidden="true" />
                      <small>{label}</small>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className={styles.fillArea}>
          <div className={styles.options}>
            <span className={styles.label}>Zapremina dekanta</span>
            <div className={styles.mlList} role="radiogroup" aria-label="Zapremina">
              {variants.map((variant) => (
                <button
                  key={variant.ml}
                  type="button"
                  role="radio"
                  aria-checked={selectedMl === variant.ml}
                  disabled={!variant.inStock}
                  className={`${styles.mlBtn} ${selectedMl === variant.ml ? styles.mlBtnActive : ""}`}
                  onClick={() => chooseMl(variant.ml)}
                >
                  <strong>{variant.ml} ml</strong>
                  <span>{variant.inStock ? formatRsd(variant.priceRsd) : "Nema"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.vialWrap}>
            <DecantVial
              color={product.liquidColor ?? bottle.color}
              ratio={vialMl ? vialMl / maxMl : 0}
              maxMl={maxMl}
              fillKey={dripKey}
              brand={product.brand}
              name={product.name}
              ml={vialMl}
              ticks={variants.map((variant) => ({ ml: variant.ml, active: variant.ml === vialMl }))}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.total}>
            <span>{selectedVariant ? `${selectedVariant.ml} ml dekant` : "Biraš zapreminu…"}</span>
            <strong>{selectedVariant ? formatRsd(selectedVariant.priceRsd) : `od ${formatRsd(minPrice)}`}</strong>
          </div>

          <button
            ref={addBtnRef}
            type="button"
            className={styles.addBtn}
            disabled={!selectedVariant?.inStock}
            onClick={addToCart}
          >
            Dodaj u korpu
          </button>
        </div>
      </div>
    </>
  );
}
