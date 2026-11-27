"use client";

import { useMemo, useRef, useState } from "react";
import { PiGift, PiPlus, PiX } from "react-icons/pi";
import { addToCartAnimated } from "@/features/cart/lib/add-to-cart-animated";
import { useCatalog } from "@/features/shop/client/catalog.api";
import { getPrimaryImage } from "@/features/shop/lib/product-images";
import BottleImg from "@/features/shop/components/showroom/bottle-img";
import { cutoutFor } from "@/features/shop/lib/cutout";
import type { CatalogProduct, ShopProduct } from "@/features/shop/types";
import {
  CUSTOM_BUNDLE_MAX,
  CUSTOM_BUNDLE_MIN,
  CUSTOM_BUNDLE_ML,
  customBundleCartId,
  customBundleDiscount,
  priceBundle,
} from "@/features/bundles/lib/bundles";
import { formatRsd, normalizeText } from "@/lib/format";
import styles from "./bundle-builder.module.css";

const hasMl = (product: CatalogProduct, ml: number) => product.variants.some((v) => v.ml === ml && v.inStock);

/** Build-your-own bundle: the customer picks 3–5 perfumes of the same volume; the discount grows with the count. */
export default function BundleBuilder() {
  const catalog = useCatalog(true);
  const [ml, setMl] = useState<number>(CUSTOM_BUNDLE_ML[0]);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState(false);
  const [note, setNote] = useState("");
  const addRef = useRef<HTMLButtonElement | null>(null);

  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const pickedProducts = picked.map((id) => byId.get(id)).filter((p): p is ShopProduct => Boolean(p));
  const full = picked.length >= CUSTOM_BUNDLE_MAX;

  const results = useMemo(() => {
    const needle = normalizeText(query.trim());
    const pool = catalog.filter((p) => hasMl(p, ml) && !picked.includes(p.id));
    if (needle.length >= 2) {
      return pool.filter((p) => normalizeText(`${p.brand} ${p.name}`).includes(needle)).slice(0, 8);
    }
    // No search: most popular first (the catalog is already sorted by Fragrantica votes).
    return pool.slice(0, 8);
  }, [catalog, ml, picked, query]);

  const discount = customBundleDiscount(picked.length);
  const priced = priceBundle(picked, catalog, ml, discount);
  const nextDiscount = customBundleDiscount(picked.length + 1);

  function add(id: string) {
    if (full) return;
    setPicked((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setQuery("");
    setNote("");
  }

  function remove(id: string) {
    setPicked((prev) => prev.filter((value) => value !== id));
  }

  function changeMl(nextMl: number) {
    setMl(nextMl);
    const dropped = picked.filter((id) => {
      const product = byId.get(id);
      return !product || !hasMl(product, nextMl);
    });
    if (dropped.length) {
      setPicked((prev) => prev.filter((id) => !dropped.includes(id)));
      setNote(`Uklonjeno jer nema ${nextMl} ml: ${dropped.map((id) => byId.get(id)?.name ?? id).join(", ")}.`);
    }
  }

  function addToCart() {
    if (picked.length < CUSTOM_BUNDLE_MIN || !priced.available) return;
    addToCartAnimated(
      {
        id: customBundleCartId(picked),
        name: "Moj paket",
        brand: "Složi svoj paket",
        imageUrl: pickedProducts[0] ? getPrimaryImage(pickedProducts[0]) : null,
        ml,
        priceRsd: priced.price,
        qty: 1,
        bundleItems: pickedProducts.map((p) => ({ id: p.id, brand: p.brand, name: p.name })),
      },
      addRef.current
    );
    setAdded(true);
    setPicked([]);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <section className={styles.builder} aria-labelledby="builder-title">
      <div className={styles.head}>
        <div>
          <span className={styles.kicker}>
            <PiGift aria-hidden="true" /> Složi svoj paket
          </span>
          <h2 id="builder-title" className={styles.title}>
            Izaberi {CUSTOM_BUNDLE_MIN}–{CUSTOM_BUNDLE_MAX} parfema, mi spakujemo
          </h2>
          <p className={styles.lead}>
            3 parfema <strong>−10%</strong> · 4 parfema <strong>−12%</strong> · 5 parfema <strong>−15%</strong>
          </p>
        </div>
        <div className={styles.mlSwitch} role="radiogroup" aria-label="Zapremina po parfemu">
          {CUSTOM_BUNDLE_ML.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={ml === value}
              className={ml === value ? styles.mlActive : ""}
              onClick={() => changeMl(value)}
            >
              po {value} ml
            </button>
          ))}
        </div>
      </div>

      {/* Mesta u paketu */}
      <ol className={styles.slots}>
        {Array.from({ length: CUSTOM_BUNDLE_MAX }, (_, index) => {
          const product = pickedProducts[index];
          return (
            <li key={index} className={product ? styles.slotFilled : styles.slot}>
              {product ? (
                <>
                  <BottleImg src={getPrimaryImage(product)} precomputed={cutoutFor(product, 384)} className={styles.slotBottle} />
                  <span className={styles.slotName}>
                    <small>{product.brand}</small>
                    {product.name}
                  </span>
                  <button type="button" className={styles.slotRemove} onClick={() => remove(product.id)} aria-label={`Ukloni ${product.name}`}>
                    <PiX />
                  </button>
                </>
              ) : (
                <span className={styles.slotEmpty}>{index + 1}</span>
              )}
            </li>
          );
        })}
      </ol>

      {note && <p className={styles.note}>{note}</p>}

      {/* Biranje parfema */}
      {!full && (
        <div className={styles.picker}>
          <input
            type="search"
            className={styles.search}
            placeholder={`Nađi parfem (svi imaju ${ml} ml)…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Pretraga parfema za paket"
          />
          <p className={styles.pickerLabel}>{query.trim().length >= 2 ? "Rezultati" : "Najpopularniji — klikni da dodaš"}</p>
          <ul className={styles.results}>
            {catalog.length === 0 && <li className={styles.loading}>Učitavam parfeme…</li>}
            {results.map((product) => {
              const price = product.variants.find((v) => v.ml === ml)?.priceRsd ?? 0;
              return (
                <li key={product.id}>
                  <button type="button" onClick={() => add(product.id)}>
                    <BottleImg src={getPrimaryImage(product)} precomputed={cutoutFor(product, 384)} className={styles.resultBottle} />
                    <span className={styles.resultName}>
                      <small>{product.brand}</small>
                      {product.name}
                    </span>
                    <em className={styles.resultPrice}>{formatRsd(price)}</em>
                    <PiPlus aria-hidden="true" className={styles.plus} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Price and add to cart */}
      <div className={styles.summary}>
        <div className={styles.price}>
          {picked.length > 0 ? (
            <>
              {discount > 0 && <s>{formatRsd(priced.regular)}</s>}
              <strong>{formatRsd(discount > 0 ? priced.price : priced.regular)}</strong>
              <small>
                {picked.length < CUSTOM_BUNDLE_MIN
                  ? `Dodaj još ${CUSTOM_BUNDLE_MIN - picked.length} za paket (−${customBundleDiscount(CUSTOM_BUNDLE_MIN)}%)`
                  : picked.length < CUSTOM_BUNDLE_MAX
                    ? `−${discount}% · dodaj još jedan za −${nextDiscount}%`
                    : `−${discount}% · najveći popust`}
              </small>
            </>
          ) : (
            <small>Izaberi parfeme ispod — cena se računa odmah.</small>
          )}
        </div>
        <button
          ref={addRef}
          type="button"
          className={styles.addBtn}
          disabled={picked.length < CUSTOM_BUNDLE_MIN || !priced.available}
          onClick={addToCart}
        >
          {added ? "Paket je u korpi ✓" : `Dodaj paket u korpu (${picked.length}/${CUSTOM_BUNDLE_MAX})`}
        </button>
      </div>
    </section>
  );
}
