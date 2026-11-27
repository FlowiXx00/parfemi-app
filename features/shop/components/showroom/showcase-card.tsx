"use client";

import Link from "next/link";
import { memo, useMemo, useRef, useState, type MouseEvent } from "react";
import { PiFire, PiStarFill } from "react-icons/pi";
import { useBottleImage, useInViewOnce } from "@/features/shop/client/use-bottle-image";
import { cutoutFor } from "@/features/shop/lib/cutout";
import { getPrimaryImage, PRODUCT_IMAGE_FALLBACK } from "@/features/shop/lib/product-images";
import EmptyBottle from "./empty-bottle";
import FragranticaRating from "../fragrantica-rating/fragrantica-rating";
import type { CatalogProduct } from "@/features/shop/types";
import { formatRsd, getPriceBounds } from "@/lib/format";
import styles from "./showcase-card.module.css";

type Props = {
  product: CatalogProduct;
  onOpen: (productId: string, sourceEl: HTMLElement) => void;
};

/**
 * Perfume in the showroom: bottle in a niche lit from above, with a price pedestal below.
 * No wishlist button on the card (clean display); it lives in the quick view and on the product page.
 */
function ShowcaseCardComponent({ product, onOpen }: Props) {
  const cardRef = useRef<HTMLElement | null>(null);
  const inView = useInViewOnce(cardRef);
  // Ready-made image from the server when there is one (no work for the browser); if that file fails to
  // load, the card falls back to processing the original image here.
  const [cutoutBroken, setCutoutBroken] = useState(false);
  const precomputed = cutoutBroken ? null : cutoutFor(product, 384);
  const bottle = useBottleImage(getPrimaryImage(product), 384, inView, precomputed);

  const soldOut = product.variants.every((variant) => !variant.inStock);

  // At most two badges, by priority: Sold out > Sale > Best seller > Featured.
  const badges = [
    soldOut && { label: "Rasprodato", tone: "badgeMuted", icon: null },
    !soldOut && product.onSale && { label: "Akcija", tone: "badgeSale", icon: null },
    product.isBestseller && { label: "Najprodavanije", tone: "badgeHot", icon: <PiFire aria-hidden="true" /> },
    product.isFeatured && { label: "Preporuka", tone: "badgeFeatured", icon: <PiStarFill aria-hidden="true" /> },
  ]
    .filter((badge): badge is { label: string; tone: string; icon: React.ReactElement | null } => Boolean(badge))
    .slice(0, 2);
  const priceText = useMemo(() => {
    const { min, max } = getPriceBounds(product.variants);
    if (!product.variants.length) return "Uskoro";
    return min === max ? formatRsd(min) : `od ${formatRsd(min)}`;
  }, [product.variants]);

  const open = () => {
    if (cardRef.current) onOpen(product.id, cardRef.current);
  };

  // The name is a real link (for Google and "open in new tab"); a regular click opens the quick view.
  const handleNameClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    open();
  };

  return (
    <article ref={cardRef} className={styles.card}>
      {badges.length > 0 && (
        // One row: the main badge with text, the second one icon-only (doesn't cover the bottle).
        <div className={styles.badges}>
          {badges.map((badge, index) =>
            index === 0 || !badge.icon ? (
              <span
                key={badge.label}
                className={`${styles.badge} ${styles[badge.tone] ?? ""} ${badge.icon ? styles.badgeWithIcon : ""}`}
                title={badge.label}
              >
                {badge.icon}
                <span className={styles.badgeLabel}>{badge.label}</span>
              </span>
            ) : (
              <span
                key={badge.label}
                className={`${styles.badge} ${styles.badgeIcon} ${styles[badge.tone] ?? ""}`}
                title={badge.label}
                role="img"
                aria-label={badge.label}
              >
                {badge.icon}
              </span>
            )
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.stage}
        onClick={open}
        aria-label={`Pogledaj ${product.brand} ${product.name}`}
      >
        <span className={styles.beam} aria-hidden="true" />

        <span className={styles.niche}>
          {bottle.ready && bottle.src === PRODUCT_IMAGE_FALLBACK ? (
            <EmptyBottle className={styles.bottleEmpty} />
          ) : bottle.ready && bottle.src ? (
            // The processed image (no background) is a blob: URL or a ready-made file in our Storage, so it
            // goes through a plain <img> (no second round through the image optimizer).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bottle.src}
              alt=""
              className={styles.bottle}
              draggable={false}
              loading="lazy"
              decoding="async"
              onError={() => precomputed && setCutoutBroken(true)}
            />
          ) : (
            <span className={styles.bottlePlaceholder} />
          )}
          <span className={styles.floorGlow} aria-hidden="true" />
        </span>

        <span className={styles.pedestal} aria-hidden="true">
          <span className={styles.pedestalTop} />
          <span className={styles.pedestalFront}>
            <span className={styles.price}>{priceText}</span>
          </span>
        </span>
      </button>

      <div className={styles.meta}>
        <span className={styles.brand}>{product.brand}</span>
        <Link
          href={`/shop/${product.id}`}
          // A regular click opens the quick view, so prefetching every product page while the visitor
          // scrolls the shop would only cost requests (and server renders) that are never used.
          prefetch={false}
          className={styles.name}
          onClick={handleNameClick}
          title={product.name}
        >
          {product.name}
        </Link>
        <span className={styles.concentration}>{product.concentration}</span>
        <FragranticaRating rating={product.rating} votes={product.votes} className={styles.rating} />
      </div>
    </article>
  );
}

const ShowcaseCard = memo(ShowcaseCardComponent);
export default ShowcaseCard;
