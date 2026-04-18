"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/shared/auth/client/use-auth-user";
import type { Product } from "@/features/shop/types";
import ProductCard from "@/features/shop/components/product-card/product-card";
import styles from "./shop-page-client.module.css";

type Props = {
  initialProducts: Product[];
  initialQuery: string;
  initialWishlistIds: string[];
};

type SortKey =
  | "nameAsc"
  | "mostPopular"
  | "bestRated"
  | "priceAsc"
  | "priceDesc";

type IndexedProduct = {
  product: Product;
  minPrice: number;
  maxPrice: number;
  searchable: string;
  rating: number;
  votes: number;
};

const DEFAULT_PER_PAGE = 12;
const DEFAULT_SORT: SortKey = "nameAsc";
const PER_PAGE_OPTIONS = [8, 12, 16, 24] as const;
const GENDERS = ["Muški", "Unisex", "Ženski"] as const;
const CONCENTRATIONS = [
  "Eau de cologne",
  "Eau de toilette",
  "Eau de parfum",
  "Extrait de parfum",
  "Parfum",
] as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getPriceBounds(product: Product) {
  if (!product.variants.length) {
    return { minPrice: 0, maxPrice: 0 };
  }

  const prices = product.variants.map((variant) => variant.priceRsd);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
}

function matchesSelectedValue(selectedValues: Set<string>, value: string) {
  return selectedValues.size === 0 || selectedValues.has(value);
}

export default function ShopClient({
  initialProducts,
  initialQuery,
  initialWishlistIds,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authUser } = useAuthUser();

  const allProducts = useMemo(
    () => (Array.isArray(initialProducts) ? initialProducts : []),
    [initialProducts]
  );

  const indexedProducts = useMemo<IndexedProduct[]>(
    () =>
      allProducts.map((product) => {
        const { minPrice, maxPrice } = getPriceBounds(product);

        return {
          product,
          minPrice,
          maxPrice,
          searchable: normalizeText(`${product.brand} ${product.name}`),
          rating: typeof product.rating === "number" ? product.rating : 0,
          votes: typeof product.votes === "number" ? product.votes : 0,
        };
      }),
    [allProducts]
  );

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const { product } of indexedProducts) {
      counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
    }

    return counts;
  }, [indexedProducts]);

  const brands = useMemo(
    () => Array.from(brandCounts.keys()).sort((left, right) => left.localeCompare(right)),
    [brandCounts]
  );

  const globalMin = useMemo(
    () => (indexedProducts.length ? Math.min(...indexedProducts.map((item) => item.minPrice)) : 0),
    [indexedProducts]
  );

  const globalMax = useMemo(
    () => (indexedProducts.length ? Math.max(...indexedProducts.map((item) => item.maxPrice)) : 0),
    [indexedProducts]
  );

  const [query, setQuery] = useState(initialQuery);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedGenders, setSelectedGenders] = useState<Set<string>>(new Set());
  const [selectedConcentrations, setSelectedConcentrations] = useState<Set<string>>(new Set());
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [draftPriceMax, setDraftPriceMax] = useState(0);
  const [priceMaxApplied, setPriceMaxApplied] = useState(0);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [showFilters, setShowFilters] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(
    () => new Set(initialWishlistIds)
  );

  const isLoggedIn = Boolean(authUser);
  const wishlistLoginHref = useMemo(() => {
    const currentPath = pathname ?? "/shop";
    const currentSearch = searchParams.toString();
    const nextPath = currentSearch ? `${currentPath}?${currentSearch}` : currentPath;

    return `/login?next=${encodeURIComponent(nextPath)}`;
  }, [pathname, searchParams]);

  const didInit = useRef(false);

  const syncFiltersState = useCallback((nextOpen: boolean) => {
    window.dispatchEvent(
      new CustomEvent("shop:filters-state", {
        detail: { open: nextOpen },
      })
    );
  }, []);

  useEffect(() => {
    if (!didInit.current && indexedProducts.length > 0 && globalMax > 0) {
      setDraftPriceMax(globalMax);
      setPriceMaxApplied(globalMax);
      didInit.current = true;
    }
  }, [globalMax, indexedProducts.length]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setWishlistIds(new Set(initialWishlistIds));
  }, [initialWishlistIds]);

  useEffect(() => {
    const openFilters = () => setShowFilters(true);
    const setFiltersState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setShowFilters(Boolean(customEvent.detail?.open));
    };

    window.addEventListener("shop:open-filters", openFilters);
    window.addEventListener("shop:set-filters-state", setFiltersState as EventListener);

    return () => {
      window.removeEventListener("shop:open-filters", openFilters);
      window.removeEventListener("shop:set-filters-state", setFiltersState as EventListener);
    };
  }, []);

  useEffect(() => {
    syncFiltersState(showFilters);

    if (!showFilters) {
      return () => {
        syncFiltersState(false);
      };
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowFilters(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      syncFiltersState(false);
    };
  }, [showFilters, syncFiltersState]);

  const replaceQueryInUrl = useCallback(
    (nextQuery: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      } else {
        params.delete("q");
      }

      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleQueryChange = useCallback(
    (nextValue: string) => {
      setQuery(nextValue);
      replaceQueryInUrl(nextValue);
    },
    [replaceQueryInUrl]
  );

  const handleWishlistChange = useCallback((productId: string, nextLiked: boolean) => {
    setWishlistIds((previousValue) => {
      const nextValue = new Set(previousValue);

      if (nextLiked) {
        nextValue.add(productId);
      } else {
        nextValue.delete(productId);
      }

      return nextValue;
    });
  }, []);

  const toggleSelectedSetValue = useCallback(
    (setter: Dispatch<SetStateAction<Set<string>>>, value: string) => {
      setter((previousValue) => {
        const nextValue = new Set(previousValue);

        if (nextValue.has(value)) {
          nextValue.delete(value);
        } else {
          nextValue.add(value);
        }

        return nextValue;
      });
    },
    []
  );

  const resetFilters = useCallback(() => {
    setQuery("");
    setSelectedBrands(new Set());
    setSelectedGenders(new Set());
    setSelectedConcentrations(new Set());
    setOnSaleOnly(false);
    setDraftPriceMax(globalMax);
    setPriceMaxApplied(globalMax);
    setPerPage(DEFAULT_PER_PAGE);
    setSort(DEFAULT_SORT);
    replaceQueryInUrl("");
  }, [globalMax, replaceQueryInUrl]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    const matchingProducts = indexedProducts.filter(({ minPrice, product, searchable }) => {
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesBrand = matchesSelectedValue(selectedBrands, product.brand);
      const matchesPrice = minPrice <= priceMaxApplied;
      const matchesGender = matchesSelectedValue(selectedGenders, product.gender);
      const matchesConcentration = matchesSelectedValue(
        selectedConcentrations,
        product.concentration
      );
      const matchesSale = !onSaleOnly || product.onSale;

      return (
        matchesQuery &&
        matchesBrand &&
        matchesPrice &&
        matchesGender &&
        matchesConcentration &&
        matchesSale
      );
    });

    const sortedProducts = [...matchingProducts].sort((left, right) => {
      if (sort === "nameAsc") {
        return left.product.name.localeCompare(right.product.name);
      }

      if (sort === "mostPopular") {
        const votesDiff = right.votes - left.votes;
        if (votesDiff !== 0) return votesDiff;

        const ratingDiff = right.rating - left.rating;
        if (ratingDiff !== 0) return ratingDiff;

        return left.product.name.localeCompare(right.product.name);
      }

      if (sort === "bestRated") {
        const ratingDiff = right.rating - left.rating;
        if (ratingDiff !== 0) return ratingDiff;

        const votesDiff = right.votes - left.votes;
        if (votesDiff !== 0) return votesDiff;

        return left.product.name.localeCompare(right.product.name);
      }

      if (sort === "priceAsc") return left.minPrice - right.minPrice;
      if (sort === "priceDesc") return right.minPrice - left.minPrice;

      return left.product.name.localeCompare(right.product.name);
    });

    return sortedProducts.map((item) => item.product);
  }, [
    indexedProducts,
    onSaleOnly,
    priceMaxApplied,
    query,
    selectedBrands,
    selectedConcentrations,
    selectedGenders,
    sort,
  ]);

  const shownProducts = useMemo(() => filtered.slice(0, perPage), [filtered, perPage]);

  return (
    <div className={styles.page}>
      {showFilters && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Zatvori filtere"
          onClick={() => setShowFilters(false)}
        />
      )}

      <main className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Shop</h1>
            <button type="button" onClick={resetFilters} className={styles.resetInlineBtn}>
              Poništi filtere
            </button>
          </div>

          <button
            type="button"
            className={styles.filtersToggle}
            onClick={() => setShowFilters(true)}
            aria-expanded={showFilters}
          >
            Filteri
          </button>
        </div>

        <div className={styles.layout}>
          <aside
            className={`${styles.sidebar} ${showFilters ? styles.sidebarOpen : ""}`}
          >
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarTitle}>Filteri</div>

              <button
                type="button"
                className={styles.closeFiltersBtn}
                onClick={() => setShowFilters(false)}
              >
                Sačuvaj i zatvori
              </button>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>PRETRAGA</div>

              <div className={styles.searchBox}>
                <input
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  placeholder="Pretraži proizvode"
                  className={styles.searchInput}
                />
                <span className={styles.searchIcon}>⌕</span>
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>CENA</div>

              <input
                type="range"
                min={globalMin}
                max={globalMax}
                value={draftPriceMax}
                onChange={(event) => setDraftPriceMax(Number(event.target.value))}
                className={styles.range}
              />

              <div className={styles.rangeInfo}>
                Cena: <b>{globalMin}</b> rsd — <b>{draftPriceMax}</b> rsd
              </div>

              <div className={styles.filterButtonRow}>
                <button
                  type="button"
                  onClick={() => setPriceMaxApplied(draftPriceMax)}
                  className={styles.primaryBtn}
                >
                  Filter
                </button>

                <button type="button" onClick={resetFilters} className={styles.secondaryBtn}>
                  Reset
                </button>
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>BREND</div>

              <div className={styles.scrollArea}>
                {brands.map((brand) => (
                  <label key={brand} className={styles.checkboxRowBetween}>
                    <span className={styles.checkboxLabelWrap}>
                      <input
                        type="checkbox"
                        checked={selectedBrands.has(brand)}
                        onChange={() => toggleSelectedSetValue(setSelectedBrands, brand)}
                      />
                      <span className={styles.checkboxText}>{brand}</span>
                    </span>

                    <span className={styles.countBadge}>{brandCounts.get(brand) ?? 0}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>POL</div>

              <div className={styles.stack}>
                {GENDERS.map((gender) => (
                  <label key={gender} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={selectedGenders.has(gender)}
                      onChange={() => toggleSelectedSetValue(setSelectedGenders, gender)}
                    />
                    <span className={styles.checkboxText}>{gender}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>KONCENTRACIJA</div>

              <div className={styles.stack}>
                {CONCENTRATIONS.map((concentration) => (
                  <label key={concentration} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={selectedConcentrations.has(concentration)}
                      onChange={() =>
                        toggleSelectedSetValue(setSelectedConcentrations, concentration)
                      }
                    />
                    <span className={styles.checkboxText}>{concentration}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>AKCIJA</div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={onSaleOnly}
                  onChange={() => setOnSaleOnly((previousValue) => !previousValue)}
                />
                <span className={styles.checkboxText}>Na akciji</span>
              </label>
            </div>
          </aside>

          <section className={styles.content}>
            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <span className={styles.toolbarLabel}>Prikaži:</span>

                <div className={styles.perPageList}>
                  {PER_PAGE_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPerPage(value)}
                      className={`${styles.perPageBtn} ${
                        perPage === value ? styles.perPageBtnActive : ""
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.sortGroup}>
                <label htmlFor="sort" className={styles.toolbarLabel}>
                  Sortiraj:
                </label>

                <select
                  id="sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className={styles.sortSelect}
                >
                  <option value="nameAsc">naziv: A–Z</option>
                  <option value="mostPopular">najpopularniji</option>
                  <option value="bestRated">najbolje ocenjeni</option>
                  <option value="priceAsc">cena: rastuće</option>
                  <option value="priceDesc">cena: opadajuće</option>
                </select>
              </div>
            </div>

            {shownProducts.length > 0 ? (
              <div className={styles.grid}>
                {shownProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    liked={wishlistIds.has(product.id)}
                    isLoggedIn={isLoggedIn}
                    wishlistLoginHref={wishlistLoginHref}
                    onWishlistChange={handleWishlistChange}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                Nema proizvoda za izabrane filtere.
              </div>
            )}

            <div className={styles.resultsInfo}>
              Prikazano {shownProducts.length} od {filtered.length}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
