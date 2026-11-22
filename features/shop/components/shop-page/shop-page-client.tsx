"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PiMagnifyingGlass, PiPackage, PiSlidersHorizontal, PiSparkle } from "react-icons/pi";
import SearchParamsSync from "@/features/shop/components/search-params-sync/search-params-sync";
import { useSessionUser } from "@/features/auth/client/use-session-user";
import { CONCENTRATIONS, type ShopProduct } from "@/features/shop/types";
import { useCatalog } from "@/features/shop/client/catalog.api";
import { compareRecommended, salesOrder } from "@/features/shop/lib/sort";
import ShowcaseCard from "@/features/shop/components/showroom/showcase-card";
import ShowcaseModal from "@/features/shop/components/showroom/showcase-modal";
import { readWishlist } from "@/features/wishlist/client/wishlist.api";
import { DAY_NIGHT, SEASONS, type WearKey } from "@/features/shop/lib/scent";
import {
  FAMILY_SLUGS,
  parseSlugList,
  SCENT_FAMILIES,
  SEASON_KEYS,
  scentFamiliesOf,
  TIME_KEYS,
  WEAR_SLUGS,
  wearKeysOf,
  type ScentFamilyKey,
} from "@/features/shop/lib/scent-filters";
import { getPriceBounds, normalizeText } from "@/lib/format";
import styles from "./shop-page-client.module.css";

type Props = {
  /** First 24 perfumes ("Recommended" order), sent in the HTML for the first screen and Google. */
  initialProducts: ShopProduct[];
  /** Total perfumes in the catalog (before the browser loads the whole catalog). */
  totalCount: number;
};

type SortKey =
  | "recommended"
  | "bestselling"
  | "nameAsc"
  | "mostPopular"
  | "bestRated"
  | "priceAsc"
  | "priceDesc";

type IndexedProduct = {
  product: ShopProduct;
  minPrice: number;
  maxPrice: number;
  searchable: string;
  rating: number;
  votes: number;
  families: Set<ScentFamilyKey>;
  wearKeys: Set<WearKey>;
};

/** Selected values of a group (empty = no filter); a perfume needs at least one of them. */
function matchesAny<T>(selected: Set<T>, values: Set<T>, keys?: readonly T[]) {
  const relevant = keys ? [...selected].filter((key) => keys.includes(key)) : [...selected];
  return relevant.length === 0 || relevant.some((key) => values.has(key));
}

// How many perfumes load at once (multiples of 12 -> full rows with 3, 4 and 6 columns).
const DEFAULT_PER_PAGE = 24;
const DEFAULT_SORT: SortKey = "recommended";


const PER_PAGE_OPTIONS = [12, 24, 48] as const;
/** Redosled polova u filteru. */
const GENDER_FILTER_ORDER = ["Muški", "Unisex", "Ženski"] as const;

function matchesSelectedValue(selectedValues: Set<string>, value: string) {
  return selectedValues.size === 0 || selectedValues.has(value);
}

export default function ShopClient({ initialProducts, totalCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Query string from the URL (filled in by SearchParamsSync after load in the browser).
  const [currentSearch, setCurrentSearch] = useState("");
  const { isLoggedIn } = useSessionUser();

  // The full catalog arrives from the cached /api/catalog route right after the first render; until then
  // the first 24 from the HTML are shown (filters wait for the full catalog).
  const catalog = useCatalog(true);
  const ready = catalog.length > 0;
  const allProducts = ready ? catalog : initialProducts;

  const indexedProducts = useMemo<IndexedProduct[]>(
    () =>
      allProducts.map((product) => {
        const { min, max } = getPriceBounds(product.variants);

        return {
          product,
          minPrice: min,
          maxPrice: max,
          searchable: normalizeText(`${product.brand} ${product.name}`),
          rating: typeof product.rating === "number" ? product.rating : 0,
          votes: typeof product.votes === "number" ? product.votes : 0,
          families: scentFamiliesOf(product.accords),
          wearKeys: wearKeysOf(product.wear),
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

  const [query, setQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  // Search within the brand list (there are 100+); checked brands always stay visible.
  const [brandQuery, setBrandQuery] = useState("");
  const visibleBrands = useMemo(() => {
    const needle = normalizeText(brandQuery.trim());
    if (!needle) return brands;
    return brands.filter((brand) => selectedBrands.has(brand) || normalizeText(brand).includes(needle));
  }, [brands, brandQuery, selectedBrands]);
  const [selectedGenders, setSelectedGenders] = useState<Set<string>>(new Set());
  const [selectedConcentrations, setSelectedConcentrations] = useState<Set<string>>(new Set());
  // Scent (fresh, sweet…) and when to wear (season, day/night). Within a group: any selected.
  const [selectedFamilies, setSelectedFamilies] = useState<Set<ScentFamilyKey>>(new Set());
  const [selectedWear, setSelectedWear] = useState<Set<WearKey>>(new Set());
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [bestsellerOnly, setBestsellerOnly] = useState(false);
  // null = no price limit (the max price is known only once the full catalog arrives).
  const [priceLimit, setPriceLimit] = useState<number | null>(null);
  const priceMaxApplied = priceLimit ?? globalMax;
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [showFilters, setShowFilters] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() => new Set());
  // Quick view: which perfume is open + the card that gets focus back after closing.
  const [showcase, setShowcase] = useState<{ id: string; sourceEl: HTMLElement } | null>(null);
  const showcaseProduct = showcase
    ? allProducts.find((product) => product.id === showcase.id) ?? null
    : null;

  const openShowcase = useCallback((id: string, sourceEl: HTMLElement) => {
    setShowcase({ id, sourceEl });
  }, []);

  const closeShowcase = useCallback(() => {
    setShowcase(null);
    // Opened from a "?open=…" link -> remove the param so the same link works next time.
    const params = new URLSearchParams(window.location.search);
    if (params.has("open")) {
      params.delete("open");
      const rest = params.toString();
      router.replace(rest ? `/shop?${rest}` : "/shop", { scroll: false });
    }
  }, [router]);

  // Quick view arrows: next/previous perfume (focus then returns to the first card).
  const navigateShowcase = useCallback((id: string) => {
    setShowcase((current) => (current ? { ...current, id } : current));
  }, []);

  const wishlistLoginHref = useMemo(() => {
    const currentPath = pathname ?? "/shop";
    const nextPath = currentSearch ? `${currentPath}?${currentSearch}` : currentPath;

    return `/login?next=${encodeURIComponent(nextPath)}`;
  }, [currentSearch, pathname]);

  // URL change (e.g. "Show all results" from the header search) -> new search.
  const handleSearchParams = useCallback((params: URLSearchParams) => {
    setCurrentSearch(params.toString());
    const urlQuery = params.get("q") ?? "";
    // Don't touch the field while the user types (the URL holds trimmed text, e.g. without a trailing
    // space).
    setQuery((previous) => (previous.trim() === urlQuery ? previous : urlQuery));

    // "/shop?open=xerjoff-naxos" (e.g. a card from the shopping assistant) -> open that perfume's quick
    // view right away.
    const openId = params.get("open");
    if (openId) setShowcase({ id: openId, sourceEl: document.body });

    // "/shop?miris=svezi&sezona=leto" (links from the home page) -> turn those filters on.
    if (params.has("miris")) setSelectedFamilies(parseSlugList(params.get("miris"), FAMILY_SLUGS));
    if (params.has("sezona")) setSelectedWear(parseSlugList(params.get("sezona"), WEAR_SLUGS));
  }, []);

  const syncFiltersState = useCallback((nextOpen: boolean) => {
    window.dispatchEvent(
      new CustomEvent("shop:filters-state", {
        detail: { open: nextOpen },
      })
    );
  }, []);

  // The wishlist is loaded only for signed-in users (one small query per user).
  useEffect(() => {
    if (!isLoggedIn) return;

    let active = true;

    void readWishlist().then((items) => {
      if (active) {
        setWishlistIds(new Set(items.map((item) => item.product_id)));
      }
    });

    return () => {
      active = false;
    };
  }, [isLoggedIn]);

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
      const params = new URLSearchParams(currentSearch);

      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      } else {
        params.delete("q");
      }

      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [currentSearch, pathname, router]
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

  // The heart in the quick view shares the wishlist state with the cards.
  const showcaseWishlist = useMemo(
    () => ({
      likedIds: wishlistIds,
      isLoggedIn,
      loginHref: wishlistLoginHref,
      onWishlistChange: handleWishlistChange,
    }),
    [handleWishlistChange, isLoggedIn, wishlistIds, wishlistLoginHref]
  );

  const toggleSelectedSetValue = useCallback(
    // The type comes from the setter (NoInfer) so "Muški" doesn't narrow Set<string> to a single literal.
    <T extends string>(setter: Dispatch<SetStateAction<Set<T>>>, value: NoInfer<T>) => {
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
    setSelectedFamilies(new Set());
    setSelectedWear(new Set());
    setOnSaleOnly(false);
    setFeaturedOnly(false);
    setBestsellerOnly(false);
    setPriceLimit(null);
    replaceQueryInUrl("");
  }, [replaceQueryInUrl]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    const matchingProducts = indexedProducts.filter(({ minPrice, product, searchable, families, wearKeys }) => {
      // Scent: any selected family; season and time of day are separate groups (e.g. "summer" AND "day").
      if (!matchesAny(selectedFamilies, families)) return false;
      if (!matchesAny(selectedWear, wearKeys, SEASON_KEYS)) return false;
      if (!matchesAny(selectedWear, wearKeys, TIME_KEYS)) return false;

      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesBrand = matchesSelectedValue(selectedBrands, product.brand);
      const matchesPrice = minPrice <= priceMaxApplied;
      const matchesGender = matchesSelectedValue(selectedGenders, product.gender);
      const matchesConcentration = matchesSelectedValue(
        selectedConcentrations,
        product.concentration
      );
      const matchesSale = !onSaleOnly || product.onSale;
      const matchesFeatured = !featuredOnly || product.isFeatured;
      const matchesBestseller = !bestsellerOnly || product.isBestseller;

      return (
        matchesQuery &&
        matchesBrand &&
        matchesPrice &&
        matchesGender &&
        matchesConcentration &&
        matchesSale &&
        matchesFeatured &&
        matchesBestseller
      );
    });

    const sortedProducts = [...matchingProducts].sort((left, right) => {
      if (sort === "recommended") return compareRecommended(left.product, right.product);

      if (sort === "bestselling") {
        const salesDiff = salesOrder(left.product) - salesOrder(right.product);
        if (salesDiff !== 0) return salesDiff;

        const votesDiff = right.votes - left.votes;
        if (votesDiff !== 0) return votesDiff;

        return left.product.name.localeCompare(right.product.name);
      }

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
    bestsellerOnly,
    featuredOnly,
    indexedProducts,
    onSaleOnly,
    priceMaxApplied,
    query,
    selectedBrands,
    selectedConcentrations,
    selectedFamilies,
    selectedGenders,
    selectedWear,
    sort,
  ]);

  // How many are shown: starts at "perPage" and "Show more" adds that many again. When filters/sorting
  // change (new list), it starts over.
  const [visible, setVisible] = useState<{ list: ShopProduct[]; count: number }>({ list: filtered, count: perPage });
  const visibleCount = visible.list === filtered ? visible.count : perPage;
  const shownProducts = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  // Until the full catalog arrives, the total comes from the server.
  const resultCount = ready ? filtered.length : totalCount;
  const remaining = Math.max(0, resultCount - shownProducts.length);

  const showMore = () => setVisible({ list: filtered, count: visibleCount + perPage });
  const changePerPage = (value: number) => {
    setPerPage(value);
    setVisible({ list: filtered, count: value });
  };

  // How many perfumes have each "highlight" flag (for the counts next to the checkboxes).
  const highlightCounts = useMemo(
    () => ({
      sale: allProducts.filter((product) => product.onSale).length,
      featured: allProducts.filter((product) => product.isFeatured).length,
      bestseller: allProducts.filter((product) => product.isBestseller).length,
    }),
    [allProducts]
  );

  // Counts next to scent families and seasons (from the whole catalog).
  const scentCounts = useMemo(() => {
    const families = new Map<ScentFamilyKey, number>();
    const wear = new Map<WearKey, number>();
    for (const item of indexedProducts) {
      item.families.forEach((key) => families.set(key, (families.get(key) ?? 0) + 1));
      item.wearKeys.forEach((key) => wear.set(key, (wear.get(key) ?? 0) + 1));
    }
    return { families, wear };
  }, [indexedProducts]);

  // Selected filters as chips above the perfumes; clicking a chip removes that filter.
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; remove: () => void }[] = [];

    if (query.trim()) {
      chips.push({ key: "q", label: `„${query.trim()}“`, remove: () => handleQueryChange("") });
    }
    selectedBrands.forEach((brand) =>
      chips.push({ key: `b-${brand}`, label: brand, remove: () => toggleSelectedSetValue(setSelectedBrands, brand) })
    );
    selectedGenders.forEach((gender) =>
      chips.push({ key: `g-${gender}`, label: gender, remove: () => toggleSelectedSetValue(setSelectedGenders, gender) })
    );
    selectedConcentrations.forEach((concentration) =>
      chips.push({
        key: `c-${concentration}`,
        label: concentration,
        remove: () => toggleSelectedSetValue(setSelectedConcentrations, concentration),
      })
    );
    selectedFamilies.forEach((key) =>
      chips.push({
        key: `f-${key}`,
        label: SCENT_FAMILIES.find((family) => family.key === key)?.label ?? key,
        remove: () => toggleSelectedSetValue(setSelectedFamilies, key),
      })
    );
    selectedWear.forEach((key) =>
      chips.push({
        key: `w-${key}`,
        label: [...SEASONS, ...DAY_NIGHT].find((item) => item.key === key)?.label ?? key,
        remove: () => toggleSelectedSetValue(setSelectedWear, key),
      })
    );
    if (priceMaxApplied < globalMax) {
      chips.push({ key: "price", label: `do ${priceMaxApplied} rsd`, remove: () => setPriceLimit(null) });
    }
    if (onSaleOnly) chips.push({ key: "sale", label: "Na akciji", remove: () => setOnSaleOnly(false) });
    if (featuredOnly) chips.push({ key: "featured", label: "Preporuka", remove: () => setFeaturedOnly(false) });
    if (bestsellerOnly) chips.push({ key: "best", label: "Najprodavanije", remove: () => setBestsellerOnly(false) });

    return chips;
  }, [
    bestsellerOnly,
    featuredOnly,
    globalMax,
    handleQueryChange,
    onSaleOnly,
    priceMaxApplied,
    query,
    selectedBrands,
    selectedConcentrations,
    selectedFamilies,
    selectedGenders,
    selectedWear,
    toggleSelectedSetValue,
  ]);

  return (
    <div className={styles.page}>
      <SearchParamsSync onChange={handleSearchParams} />

      {showFilters && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Zatvori filtere"
          onClick={() => setShowFilters(false)}
        />
      )}

      <main className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.kicker}>Kolekcija</span>
            <h1 className={styles.title}>Svi parfemi</h1>
            <p className={styles.subtitle}>
              {totalCount} originalnih parfema, dekantiranih u bočice po tvojoj meri.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link href="/paketi" className={styles.headerLink}>
              <PiPackage aria-hidden="true" /> Paketi za probu
            </Link>
            <Link href="/kviz" className={styles.headerLink}>
              <PiSparkle aria-hidden="true" /> Uradi kviz
            </Link>
          </div>
        </header>

        <div className={styles.layout}>
          <aside
            className={`${styles.sidebar} ${showFilters ? styles.sidebarOpen : ""}`}
          >
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarTitle}>
                <PiSlidersHorizontal aria-hidden="true" /> Filteri
              </div>
              {activeChips.length > 0 && (
                <button type="button" className={styles.sidebarReset} onClick={resetFilters}>
                  Poništi
                </button>
              )}

              <button
                type="button"
                className={styles.closeFiltersBtn}
                onClick={() => setShowFilters(false)}
              >
                Sačuvaj i zatvori
              </button>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>MIRIS</div>
              <div className={styles.pills} role="group" aria-label="Vrsta mirisa">
                {SCENT_FAMILIES.map((family) => {
                  const count = scentCounts.families.get(family.key) ?? 0;
                  const active = selectedFamilies.has(family.key);
                  return (
                    <button
                      key={family.key}
                      type="button"
                      aria-pressed={active}
                      disabled={ready && count === 0 && !active}
                      className={`${styles.pill} ${active ? styles.pillActive : ""}`}
                      onClick={() => toggleSelectedSetValue(setSelectedFamilies, family.key)}
                    >
                      {family.label}
                      {ready && <span>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>KADA NOSITI</div>
              <div className={styles.pills} role="group" aria-label="Kada nositi">
                {[...SEASONS, ...DAY_NIGHT].map(({ key, label }) => {
                  const count = scentCounts.wear.get(key) ?? 0;
                  const active = selectedWear.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      disabled={ready && count === 0 && !active}
                      className={`${styles.pill} ${active ? styles.pillActive : ""}`}
                      onClick={() => toggleSelectedSetValue(setSelectedWear, key)}
                    >
                      {label}
                      {ready && <span>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>CENA</div>

              <input
                type="range"
                min={globalMin}
                max={globalMax}
                value={priceMaxApplied}
                onChange={(event) => setPriceLimit(Number(event.target.value))}
                disabled={!ready}
                className={styles.range}
                aria-label="Najviša cena"
              />

              <div className={styles.rangeInfo}>
                od <b>{globalMin}</b> do <b>{priceMaxApplied}</b> rsd
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>IZDVOJENO</div>

              <div className={styles.stack}>
                {[
                  { label: "Na akciji", checked: onSaleOnly, toggle: () => setOnSaleOnly((v) => !v), count: highlightCounts.sale },
                  { label: "Preporuka", checked: featuredOnly, toggle: () => setFeaturedOnly((v) => !v), count: highlightCounts.featured },
                  { label: "Najprodavanije", checked: bestsellerOnly, toggle: () => setBestsellerOnly((v) => !v), count: highlightCounts.bestseller },
                ].map((option) => (
                  <label key={option.label} className={styles.checkboxRowBetween}>
                    <span className={styles.checkboxLabelWrap}>
                      <input
                        type="checkbox"
                        checked={option.checked}
                        onChange={option.toggle}
                        disabled={ready && option.count === 0 && !option.checked}
                      />
                      <span className={styles.checkboxText}>{option.label}</span>
                    </span>
                    {ready && <span className={styles.countBadge}>{option.count}</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.filterSection}>
              <div className={styles.filterLabel}>BREND</div>

              {brands.length > 12 && (
                <input
                  type="search"
                  className={styles.brandSearch}
                  placeholder={`Nađi brend (${brands.length})…`}
                  value={brandQuery}
                  onChange={(event) => setBrandQuery(event.target.value)}
                  aria-label="Pretraga brendova"
                />
              )}

              <div className={styles.scrollArea}>
                {!ready && <div className={styles.brandEmpty}>Učitavanje brendova…</div>}
                {ready && visibleBrands.length === 0 && <div className={styles.brandEmpty}>Nema brenda „{brandQuery}”.</div>}
                {visibleBrands.map((brand) => (
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
                {GENDER_FILTER_ORDER.map((gender) => (
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

          </aside>

          <section className={styles.content}>
            {/* Top: search + sorting */}
            <div className={styles.toolbar}>
              <div className={styles.toolbarSearch}>
                <PiMagnifyingGlass className={styles.searchIcon} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  placeholder="Pretraži parfeme ili brend…"
                  className={styles.searchInput}
                  aria-label="Pretraga parfema"
                />
              </div>

              <button
                type="button"
                className={styles.filtersToggle}
                onClick={() => setShowFilters(true)}
                aria-expanded={showFilters}
              >
                <PiSlidersHorizontal aria-hidden="true" />
                Filteri
                {activeChips.length > 0 && <span className={styles.filtersCount}>{activeChips.length}</span>}
              </button>

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
                  <option value="recommended">preporučeno</option>
                  <option value="bestselling">najprodavanije</option>
                  <option value="nameAsc">naziv: A–Z</option>
                  <option value="mostPopular">najpopularniji</option>
                  <option value="bestRated">najbolje ocenjeni</option>
                  <option value="priceAsc">cena: rastuće</option>
                  <option value="priceDesc">cena: opadajuće</option>
                </select>
              </div>
            </div>

            {/* Below: result count, active filters, items per page */}
            <div className={styles.resultsBar}>
              <div className={styles.chips}>
                <span className={styles.resultsCount}>
                  {resultCount} {resultCount === 1 ? "parfem" : "parfema"}
                </span>

                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={styles.chip}
                    onClick={chip.remove}
                    aria-label={`Ukloni filter ${chip.label}`}
                  >
                    {chip.label} <span aria-hidden="true">✕</span>
                  </button>
                ))}

                {activeChips.length > 1 && (
                  <button type="button" className={styles.clearAll} onClick={resetFilters}>
                    Poništi sve
                  </button>
                )}
              </div>

              <div className={styles.toolbarGroup}>
                <span className={styles.toolbarLabel}>Prikaži:</span>
                <div className={styles.perPageList}>
                  {PER_PAGE_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => changePerPage(value)}
                      className={`${styles.perPageBtn} ${perPage === value ? styles.perPageBtnActive : ""}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!ready && activeChips.length > 0 ? (
              <div className={styles.emptyState} aria-busy="true">
                <span>Učitavam parfeme…</span>
              </div>
            ) : shownProducts.length > 0 ? (
              <div className={styles.grid}>
                {shownProducts.map((product) => (
                  <ShowcaseCard key={product.id} product={product} onOpen={openShowcase} />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <PiMagnifyingGlass />
                </span>
                <strong>Nema parfema za izabrane filtere</strong>
                <span>Probaj da ukloniš neki filter ili pretraži drugi naziv.</span>
                {activeChips.length > 0 && (
                  <button type="button" className={styles.emptyReset} onClick={resetFilters}>
                    Poništi filtere
                  </button>
                )}
              </div>
            )}

            {resultCount > 0 && (
              <div className={styles.loadMore}>
                <span className={styles.loadMoreText}>
                  Prikazano {shownProducts.length} od {resultCount} parfema
                </span>
                <span className={styles.loadMoreBar} aria-hidden="true">
                  <span style={{ width: `${(shownProducts.length / resultCount) * 100}%` }} />
                </span>
                {remaining > 0 && (
                  <div className={styles.loadMoreActions}>
                    <button type="button" className={styles.loadMoreBtn} onClick={showMore} disabled={!ready}>
                      Prikaži još {Math.min(perPage, remaining)}
                    </button>
                    {remaining > perPage && (
                      <button
                        type="button"
                        className={styles.loadAllBtn}
                        onClick={() => setVisible({ list: filtered, count: filtered.length })}
                        disabled={!ready}
                      >
                        Prikaži sve ({resultCount})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {showcaseProduct && showcase && (
        <ShowcaseModal
          // A perfume opened from a link (e.g. from the shopping assistant) doesn't have to be in the
          // current filtered list.
          products={
            filtered.some((product) => product.id === showcaseProduct.id) ? filtered : [showcaseProduct, ...filtered]
          }
          productId={showcaseProduct.id}
          returnFocusTo={showcase.sourceEl}
          onNavigate={navigateShowcase}
          onClose={closeShowcase}
          wishlist={showcaseWishlist}
        />
      )}
    </div>
  );
}
