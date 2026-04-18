"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  memo,
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import { FiHeart } from "react-icons/fi";
import type { Product } from "@/features/shop/types";
import {
  addToWishlist,
  removeFromWishlist,
} from "@/features/wishlist/client/wishlist.api";
import styles from "./product-card.module.css";

function formatRsd(n: number) {
  return new Intl.NumberFormat("sr-RS").format(n) + " rsd";
}

function priceRange(product: Product) {
  if (!product.variants.length) {
    return { min: 0, max: 0 };
  }

  const prices = product.variants.map((variant) => variant.priceRsd);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

const Stars = memo(function Stars({
  rating = 0,
  votes = 0,
}: {
  rating?: number | null;
  votes?: number | null;
}) {
  const safeRating = Math.max(0, Math.min(5, rating ?? 0));
  const safeVotes = Math.max(0, votes ?? 0);
  const fillPercent = `${(safeRating / 5) * 100}%`;

  const tooltip =
    safeVotes > 0
      ? `${safeRating.toFixed(2)} / 5 za ${safeVotes.toLocaleString("sr-RS")} glasova`
      : "Još nema ocena";

  return (
    <div className={styles.stars} aria-label={tooltip} title={tooltip}>
      <div className={styles.starsBase}>★★★★★</div>
      <div className={styles.starsFill} style={{ width: fillPercent }}>
        ★★★★★
      </div>
    </div>
  );
});

type ProductCardProps = {
  product: Product;
  liked: boolean;
  isLoggedIn: boolean;
  wishlistLoginHref: string;
  onWishlistChange: (productId: string, nextLiked: boolean) => void;
};

function ProductCardComponent({
  product,
  liked,
  isLoggedIn,
  wishlistLoginHref,
  onWishlistChange,
}: ProductCardProps) {
  const router = useRouter();
  const [selectedMl, setSelectedMl] = useState<string>("");
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const soldOut = useMemo(
    () => product.variants.every((variant) => !variant.inStock),
    [product.variants]
  );
  const { min, max } = useMemo(() => priceRange(product), [product]);

  const selectedVariant = useMemo(() => {
    if (!selectedMl) return null;

    const mlNum = Number(selectedMl);
    return product.variants.find((variant) => variant.ml === mlNum) ?? null;
  }, [selectedMl, product.variants]);

  const priceText = useMemo(() => {
    if (selectedVariant) {
      return `${selectedVariant.ml}ml — ${formatRsd(selectedVariant.priceRsd)}`;
    }

    return min === max ? formatRsd(min) : `${formatRsd(min)} - ${formatRsd(max)}`;
  }, [max, min, selectedVariant]);

  const handleWishlistToggle = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!isLoggedIn) {
        router.push(wishlistLoginHref);
        return;
      }

      if (wishlistLoading) return;

      const previousLiked = liked;
      const optimisticLiked = !previousLiked;

      onWishlistChange(product.id, optimisticLiked);

      try {
        setWishlistLoading(true);

        if (previousLiked) {
          const removed = await removeFromWishlist(product.id);
          onWishlistChange(product.id, removed ? false : previousLiked);
          return;
        }

        const added = await addToWishlist(product.id, {
          preferred_ml: selectedMl ? Number(selectedMl) : null,
        });
        onWishlistChange(product.id, added ? true : previousLiked);
      } catch {
        onWishlistChange(product.id, previousLiked);
      } finally {
        setWishlistLoading(false);
      }
    },
    [
      isLoggedIn,
      liked,
      onWishlistChange,
      product.id,
      router,
      selectedMl,
      wishlistLoading,
      wishlistLoginHref,
    ]
  );

  const handleImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      event.currentTarget.src = "/perfumes/no-image.png";
    },
    []
  );

  return (
    <article className={styles.card}>
      {(soldOut || product.onSale) && (
        <div className={styles.badge}>{soldOut ? "SOLD OUT" : "AKCIJA"}</div>
      )}

      <button
        type="button"
        className={`${styles.wishBtn} ${liked ? styles.wishBtnActive : ""}`}
        aria-label={liked ? "Ukloni iz liste želja" : "Dodaj u listu želja"}
        aria-pressed={liked}
        title={liked ? "Ukloni iz liste želja" : "Dodaj u listu želja"}
        disabled={wishlistLoading}
        onClick={handleWishlistToggle}
      >
        <FiHeart className={styles.wishIcon} />
      </button>

      <div className={styles.imageWrap}>
        <img
          src={`/perfumes/${product.id}/parfem.png`}
          alt={product.name}
          className={styles.image}
          loading="lazy"
          onError={handleImageError}
        />
      </div>

      <div className={styles.content}>
        <select
          disabled={soldOut}
          value={selectedMl}
          onChange={(event) => setSelectedMl(event.target.value)}
          className={styles.select}
        >
          <option value="">Izaberi opciju</option>
          {product.variants.map((variant) => (
            <option
              key={variant.ml}
              value={String(variant.ml)}
              disabled={!variant.inStock}
            >
              {variant.ml}ml - {formatRsd(variant.priceRsd)} {variant.inStock ? "" : "(nema)"}
            </option>
          ))}
        </select>

        <div className={`${styles.info} autofit-parent`}>
          <h3
            className={styles.title}
            title={product.name}
            data-autofit
            data-autofit-max="15"
            data-autofit-min="11"
          >
            {product.name}
          </h3>

          <div className={styles.price}>{priceText}</div>

          <div className={styles.buttonWrap}>
            {selectedMl ? (
              <Link
                href={`/shop/${product.id}?ml=${selectedMl}`}
                className={styles.detailsBtn}
              >
                DETALJI
              </Link>
            ) : (
              <div
                className={styles.detailsBtnDisabled}
                title="Prvo izaberi militražu"
              >
                DETALJI
              </div>
            )}
          </div>

          <Stars rating={product.rating} votes={product.votes} />
        </div>
      </div>
    </article>
  );
}

const ProductCard = memo(ProductCardComponent);

export default ProductCard;
