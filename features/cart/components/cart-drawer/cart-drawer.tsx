"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./cart-drawer.module.css";

export type CartItem = {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string | null;
  ml: number;
  priceRsd: number;
  qty: number;
};

function formatRsd(n: number) {
  return new Intl.NumberFormat("sr-RS").format(n) + " rsd";
}

export default function CartDrawer({
  open,
  onClose,
  items,
  onInc,
  onDec,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onInc: (id: string, ml: number) => void;
  onDec: (id: string, ml: number) => void;
  onRemove: (id: string, ml: number) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // lock scroll
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
      {/* Overlay */}
      <button
        className={`${styles.overlay} ${open ? styles.open : ""}`}
        onClick={onClose}
        aria-label="Zatvori korpu"
        type="button"
      />

      {/* Drawer */}
      <aside
        className={`${styles.drawer} ${open ? styles.open : ""}`}
        aria-hidden={!open}
        aria-label="Korpa"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>Korpa</div>

          <button className={styles.closeBtn} onClick={onClose} type="button">
            ✕ Zatvori
          </button>
        </div>

        {/* Body */}
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.thumbImg} src={it.imageUrl} alt="" />
                    ) : (
                      <div className={styles.thumbPlaceholder}>img</div>
                    )}
                  </div>

                  <div className={styles.meta}>
                    <div className={styles.name}>
                      {it.name} {it.ml}ml
                    </div>

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

        {/* Footer (samo kad ima items) */}
        {!isEmpty && (
          <div className={styles.footer}>
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

/* ===== Ikonica za empty state (kao na slici) ===== */
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