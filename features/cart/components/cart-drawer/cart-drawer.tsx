"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./cart-drawer.module.css";
import CartMlPicker from "@/features/cart/components/cart-ml-picker/cart-ml-picker";
import FreeShippingBar from "@/features/cart/components/free-shipping-bar/free-shipping-bar";
import BundleContents, { BundleThumbBadge, CartThumbFallback, isBundleItem } from "@/features/cart/components/bundle-contents/bundle-contents";
import type { CartItem } from "@/features/cart/types";
import { stripBrandPrefix } from "@/features/shop/lib/product-name";
import { formatRsd } from "@/lib/format";

export default function CartDrawer({
  open,
  onClose,
  items,
  onInc,
  onDec,
  onRemove,
  onChangeMl,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onInc: (id: string, ml: number) => void;
  onDec: (id: string, ml: number) => void;
  onRemove: (id: string, ml: number) => void;
  onChangeMl: (id: string, fromMl: number, toMl: number, priceRsd: number) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const total = items.reduce((sum, it) => sum + it.priceRsd * it.qty, 0);
  const isEmpty = items.length === 0;

  return (
    <>
      <button
        className={`${styles.overlay} ${open ? styles.open : ""}`}
        onClick={onClose}
        aria-label="Zatvori korpu"
        type="button"
      />

      <aside
        className={`${styles.drawer} ${open ? styles.open : ""}`}
        aria-hidden={!open}
        // Closed drawer: out of the tab order and hidden from screen readers
        inert={!open}
        aria-label="Korpa"
      >
        <div className={styles.header}>
          <div className={styles.title}>Korpa</div>

          <button className={styles.closeBtn} onClick={onClose} type="button">
            ✕ Zatvori
          </button>
        </div>

        <div className={styles.body}>
          {isEmpty ? (
            <div className={styles.emptyState}>
              <CartEmptyIcon className={styles.emptyIcon ?? ""} />
              <div className={styles.emptyText}>Vaša korpa je prazna.</div>

              <Link href="/shop" className={styles.emptyBtn} onClick={onClose}>
                VRATI SE NA SHOP
              </Link>
            </div>
          ) : (
            <div className={styles.list}>
              {items.map((it) => (
                <div key={`${it.id}-${it.ml}`} className={styles.item}>
                  <div className={styles.thumb}>
                    {it.imageUrl ? (
                      <Image
                        className={styles.thumbImg}
                        src={it.imageUrl}
                        alt=""
                        width={64}
                        height={64}
                        sizes="64px"
                      />
                    ) : (
                      <CartThumbFallback item={it} />
                    )}
                    <BundleThumbBadge item={it} />
                  </div>

                  <div className={styles.meta}>
                    {it.brand && <div className={styles.brand}>{it.brand}</div>}
                    <div className={styles.name}>{stripBrandPrefix(it.brand, it.name)}</div>

                    {open &&
                      (isBundleItem(it) ? (
                        <BundleContents item={it} compact />
                      ) : (
                        <CartMlPicker
                          productId={it.id}
                          currentMl={it.ml}
                          onChange={(toMl, price) => onChangeMl(it.id, it.ml, toMl, price)}
                        />
                      ))}

                    <div className={styles.sub}>
                      {formatRsd(it.priceRsd)} · kom: {it.qty}
                    </div>

                    <div className={styles.controls}>
                      <div className={styles.qtyBox} role="group" aria-label="Količina">
                        <button
                          className={styles.qtyBtn}
                          onClick={() => onDec(it.id, it.ml)}
                          type="button"
                          aria-label="Smanji količinu"
                        >
                          −
                        </button>

                        <div className={styles.qtyNum} aria-label="Trenutna količina">
                          {it.qty}
                        </div>

                        <button
                          className={styles.qtyBtn}
                          onClick={() => onInc(it.id, it.ml)}
                          type="button"
                          aria-label="Povećaj količinu"
                        >
                          +
                        </button>
                      </div>

                      <button
                        className={styles.removeBtn}
                        onClick={() => onRemove(it.id, it.ml)}
                        type="button"
                        title="Ukloni"
                        aria-label="Ukloni"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className={styles.sum}>{formatRsd(it.priceRsd * it.qty)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isEmpty && (
          <div className={styles.footer}>
            {/* No coupon here (it's applied on the cart page), so this is an estimate; the exact total is in the cart. */}
            <FreeShippingBar goodsTotal={total} compact />

            <div className={styles.totalRow}>
              <div>Ukupno:</div>
              <div>{formatRsd(total)}</div>
            </div>

            <div className={styles.actionRow}>
              <Link
                href="/cart"
                className={styles.primaryBtn}
                onClick={onClose}
              >
                Plaćanje
              </Link>

              <Link
                href="/shop"
                className={styles.secondaryBtn}
                onClick={onClose}
              >
                Vrati se na shop
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function CartEmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M16 18h6l3 26h24l4-18H23"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 52a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM50 52a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
        fill="currentColor"
      />
      <path
        d="M39 18l12 12M51 18L39 30"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
