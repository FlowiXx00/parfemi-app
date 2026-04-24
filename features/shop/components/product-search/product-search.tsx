"use client";

import Link from "next/link";
import Image from "next/image";
import {
  memo,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiSearch } from "react-icons/fi";
import styles from "./product-search.module.css";
import { getPrimaryProductImage } from "@/features/shop/lib/product-gallery";

type Variant = { ml: number; priceRsd: number; inStock: boolean };

type Product = {
  id: string;
  name: string;
  brand: string;
  variants: Variant[];
};

function formatRsd(n: number) {
  return new Intl.NumberFormat("sr-RS").format(n) + " rsd";
}

function priceRange(product: Product) {
  const prices = (product.variants ?? []).map((variant) => variant.priceRsd).filter(Boolean);

  if (prices.length === 0) return "Cena uskoro";

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max ? formatRsd(min) : `${formatRsd(min)} – ${formatRsd(max)}`;
}

function useDebounced<T>(value: T, ms = 160) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), ms);
    return () => window.clearTimeout(timeoutId);
  }, [value, ms]);

  return debouncedValue;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="100%" height="100%" fill="var(--surface-2)"/>
      <text
        x="50%"
        y="50%"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="var(--text-muted)"
        font-family="Arial, sans-serif"
        font-size="14"
      >
        No image
      </text>
    </svg>
  `);

type HeaderSearchProps = {
  products: Product[];
  onNavigate?: () => void;
};

function HeaderSearchComponent({ products, onNavigate }: HeaderSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 180);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const indexedProducts = useMemo(
    () =>
      (products ?? []).map((product) => ({
        product,
        searchable: normalizeText(`${product.brand} ${product.name}`),
        normalizedBrand: normalizeText(product.brand ?? ""),
        normalizedName: normalizeText(product.name ?? ""),
      })),
    [products]
  );

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  const results = useMemo(() => {
    const normalizedQuery = normalizeText(debouncedQuery);

    if (!normalizedQuery) return [];

    const queryTerms = normalizedQuery.split(" ").filter(Boolean);

    const scored = indexedProducts
      .map(({ product, searchable, normalizedBrand, normalizedName }) => {
        if (!searchable) return null;

        let score = 0;

        if (searchable.startsWith(normalizedQuery)) score += 120;
        if (normalizedName.startsWith(normalizedQuery)) score += 100;
        if (normalizedBrand.startsWith(normalizedQuery)) score += 80;
        if (searchable.includes(normalizedQuery)) score += 60;

        for (const term of queryTerms) {
          if (normalizedName.includes(term)) score += 22;
          if (normalizedBrand.includes(term)) score += 18;
          if (searchable.includes(term)) score += 10;
        }

        if (score <= 0) return null;

        return { product, score };
      })
      .filter(Boolean) as { product: Product; score: number }[];

    return scored
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map((item) => item.product);
  }, [debouncedQuery, indexedProducts]);

  const hasQuery = debouncedQuery.trim().length > 0;

  const handleNavigate = useCallback(() => {
    setOpen(false);
    onNavigate?.();
  }, [onNavigate]);

  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  const handleImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      event.currentTarget.src = FALLBACK_IMAGE;
    },
    []
  );

  return (
    <div className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Pretraga"
        aria-expanded={open}
        onClick={() => setOpen((previousValue) => !previousValue)}
        className={`${styles.trigger} ${open ? styles.triggerActive : ""}`}
      >
        <FiSearch />
      </button>

      {open && (
        <div ref={panelRef} className={styles.panel}>
          <div className={styles.topRow}>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pretraži parfeme ili brend…"
              className={styles.input}
            />

            <button
              type="button"
              onClick={handleClear}
              aria-label="Obriši"
              className={styles.clearBtn}
              title="Obriši"
            >
              ✕
            </button>
          </div>

          <div className={styles.body}>
            {!hasQuery ? (
              <div className={styles.emptyState}>
                Kreni da kucaš naziv parfema ili brend.
              </div>
            ) : results.length === 0 ? (
              <div className={styles.emptyState}>
                Nema rezultata za “{debouncedQuery.trim()}”.
              </div>
            ) : (
              <div className={styles.results}>
                {results.map((product) => (
                  <Link
                    key={product.id}
                    href={`/shop/${product.id}`}
                    onClick={handleNavigate}
                    className={styles.resultItem}
                  >
                    <div className={styles.thumb}>
                      <Image
                        src={getPrimaryProductImage(product.id)}
                        alt={product.name}
                        width={64}
                        height={64}
                        unoptimized
                        className={styles.thumbImage}
                        onError={handleImageError}
                      />
                    </div>

                    <div className={styles.resultText}>
                      <div className={styles.resultBrand}>{product.brand}</div>
                      <div className={styles.resultName}>{product.name}</div>
                      <div className={styles.resultPrice}>{priceRange(product)}</div>
                    </div>
                  </Link>
                ))}

                <Link
                  href={`/shop?q=${encodeURIComponent(debouncedQuery.trim())}`}
                  onClick={handleNavigate}
                  className={styles.viewAll}
                >
                  <span>Prikaži sve rezultate</span>
                  <span>→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const HeaderSearch = memo(HeaderSearchComponent);

export default HeaderSearch;
