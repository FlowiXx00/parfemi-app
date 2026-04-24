"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./cart-page.module.css";
import type { AddressRow } from "@/features/account/types";
import { createClient } from "@/shared/supabase/supabase-client";
import { loadAddressesRequest } from "@/features/account/client/addresses.api";
import {
  clearCart,
  decCartItem,
  incCartItem,
  removeCartItem,
} from "@/features/cart/client/cart.storage";
import { useCartState } from "@/features/cart/client/use-cart-state";
import {
  Coupon,
  findCoupon,
  getCouponDiscount,
  normalizeCouponCode,
} from "@/features/orders/lib/coupons";

const steps = ["Korpa", "Checkout", "Uspešna porudžbina"];

type CheckoutForm = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  note: string;
};

const initialForm: CheckoutForm = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  address: "",
  note: "",
};

function formatRsd(n: number) {
  return new Intl.NumberFormat("sr-RS").format(n) + " rsd";
}

export default function CartPageClient() {
  const { cartItems: items, refreshCart, setCartItems: setItems } = useCartState();
  const [step, setStep] = useState(0);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponState, setCouponState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(initialForm);

  const [savedAddresses, setSavedAddresses] = useState<AddressRow[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const isApplyingSavedAddressRef = useRef(false);
  const couponTimeoutRef = useRef<number | null>(null);
  const addressSyncTimeoutRef = useRef<number | null>(null);

  const clearCouponTimeout = useCallback(() => {
    if (couponTimeoutRef.current !== null) {
      window.clearTimeout(couponTimeoutRef.current);
      couponTimeoutRef.current = null;
    }
  }, []);

  const clearAddressSyncTimeout = useCallback(() => {
    if (addressSyncTimeoutRef.current !== null) {
      window.clearTimeout(addressSyncTimeoutRef.current);
      addressSyncTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCouponTimeout();
      clearAddressSyncTimeout();
    };
  }, [clearAddressSyncTimeout, clearCouponTimeout]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.priceRsd * item.qty, 0),
    [items]
  );

  const totalQty = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items]
  );

  const totalItems = items.length;

  const discount = useMemo(
    () => getCouponDiscount(subtotal, appliedCoupon),
    [subtotal, appliedCoupon]
  );

  const shippingCost = items.length > 0 ? 580 : 0;
  const total = Math.max(0, subtotal - discount + shippingCost);

  const couponProgress =
    couponState === "loading" ? 70 : couponState === "success" ? 100 : 0;

  const canContinueToCheckout = items.length > 0;

  useEffect(() => {
    if (!appliedCoupon) return;

    if (appliedCoupon.minSubtotal && subtotal < appliedCoupon.minSubtotal) {
      setCouponState("error");
      setCouponMessage(
        `Kod ${appliedCoupon.code} važi tek od ${formatRsd(
          appliedCoupon.minSubtotal
        )}.`
      );
      setAppliedCoupon(null);
    }
  }, [subtotal, appliedCoupon]);

  useEffect(() => {
    if (step !== 1) return;

    let cancelled = false;

    async function initCheckoutData() {
      try {
        setIsLoadingAddresses(true);

        const supabase = createClient();

        const user = supabase
          ? (
              await supabase.auth.getUser()
            ).data.user
          : null;

        if (cancelled) return;

        const userEmail = user?.email ?? "";
        const addresses = user ? await loadAddressesRequest().catch(() => []) : [];

        if (cancelled) return;

        if (userEmail) {
          setCheckoutForm((prev) => ({
            ...prev,
            email: prev.email || userEmail,
          }));
        }

        setSavedAddresses(addresses);

        const defaultAddress =
          addresses.find((item) => item.is_default) ?? addresses[0] ?? null;

        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);

          setCheckoutForm((prev) => ({
            ...prev,
            fullName: prev.fullName || defaultAddress.full_name,
            email: prev.email || userEmail,
            phone: prev.phone || defaultAddress.phone,
            city: prev.city || defaultAddress.city,
            address:
              prev.address ||
              [defaultAddress.street, defaultAddress.apartment]
                .filter(Boolean)
                .join(", "),
            note: prev.note || defaultAddress.note || "",
          }));
        } else {
          setSelectedAddressId("new");
        }
      } catch (error) {
        console.error("Greška pri učitavanju checkout podataka:", error);
        if (!cancelled) {
          setSavedAddresses([]);
          setSelectedAddressId("new");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAddresses(false);
        }
      }
    }

    initCheckoutData();

    return () => {
      cancelled = true;
    };
  }, [step]);

  const handleInc = useCallback((id: string, ml: number) => {
    incCartItem(id, ml);
    refreshCart();
  }, [refreshCart]);

  const handleDec = useCallback((id: string, ml: number) => {
    decCartItem(id, ml);
    refreshCart();
  }, [refreshCart]);

  const handleRemove = useCallback((id: string, ml: number) => {
    removeCartItem(id, ml);
    refreshCart();
  }, [refreshCart]);

  function handleApplyCoupon() {
    const normalized = normalizeCouponCode(couponInput);

    if (!normalized) {
      setCouponState("error");
      setCouponMessage("Unesite kupon kod.");
      setAppliedCoupon(null);
      return;
    }

    setCouponState("loading");
    setCouponMessage("Proveravamo kupon...");

    clearCouponTimeout();

    couponTimeoutRef.current = window.setTimeout(() => {
      couponTimeoutRef.current = null;

      const found = findCoupon(normalized);

      if (!found) {
        setCouponState("error");
        setCouponMessage("Kupon nije pronađen.");
        setAppliedCoupon(null);
        return;
      }

      if (found.minSubtotal && subtotal < found.minSubtotal) {
        setCouponState("error");
        setCouponMessage(
          `Za ovaj kupon potrebno je najmanje ${formatRsd(
            found.minSubtotal
          )} u korpi.`
        );
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon(found);
      setCouponInput(found.code);
      setCouponState("success");
      setCouponMessage(`Uspešno primenjen kupon ${found.code}.`);
      couponTimeoutRef.current = null;
    }, 650);
  }

  function handleRemoveCoupon() {
    clearCouponTimeout();
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponState("idle");
    setCouponMessage("Kupon je uklonjen.");
  }

  function updateField<K extends keyof CheckoutForm>(
    key: K,
    value: CheckoutForm[K]
  ) {
    setCheckoutForm((prev) => ({ ...prev, [key]: value }));
  }

  function fillCheckoutFromAddress(address: AddressRow) {
    isApplyingSavedAddressRef.current = true;

    setCheckoutForm((prev) => ({
      ...prev,
      fullName: address.full_name,
      phone: address.phone,
      city: address.city,
      address: [address.street, address.apartment].filter(Boolean).join(", "),
      note: address.note ?? "",
    }));

    clearAddressSyncTimeout();

    addressSyncTimeoutRef.current = window.setTimeout(() => {
      isApplyingSavedAddressRef.current = false;
      addressSyncTimeoutRef.current = null;
    }, 0);
  }

  function handleSelectSavedAddress(addressId: string) {
    const address = savedAddresses.find((item) => item.id === addressId);

    if (!address) return;

    setSelectedAddressId(addressId);
    fillCheckoutFromAddress(address);
  }

  function handleUseNewAddress() {
    setSelectedAddressId("new");
    setCheckoutForm((prev) => ({
      ...prev,
      fullName: "",
      phone: "",
      city: "",
      address: "",
      note: "",
    }));
  }

  function updateShippingField<K extends keyof CheckoutForm>(
    key: K,
    value: CheckoutForm[K]
  ) {
    if (
      selectedAddressId !== "new" &&
      !isApplyingSavedAddressRef.current &&
      ["fullName", "phone", "city", "address", "note"].includes(key)
    ) {
      setSelectedAddressId("new");
    }

    updateField(key, value);
  }

  async function handleCheckoutSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!items.length) {
      setStep(0);
      return;
    }

    setIsSubmittingOrder(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
            fullName: checkoutForm.fullName,
            email: checkoutForm.email,
            phone: checkoutForm.phone,
            city: checkoutForm.city,
            address: checkoutForm.address,
            note: checkoutForm.note,
          },
          couponCode: appliedCoupon?.code ?? null,
          subtotalRsd: subtotal,
          discountRsd: discount,
          shippingRsd: shippingCost,
          totalRsd: total,
          items,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Greška pri slanju porudžbine.");
      }

      setOrderNumber(data.orderNumber);
      setStep(2);
      clearCart();
      setItems([]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Greška pri slanju porudžbine."
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Vaša porudžbina</p>
        <h1 className={styles.title}>Korpa i kuponi</h1>
        <p className={styles.subtitle}>
          Pregledajte proizvode, primenite kupon i nastavite na checkout kada vam
          sve odgovara.
        </p>
      </section>

      <section className={styles.stepper} aria-label="Koraci kupovine">
        {steps.map((label, index) => {
          const isActive = index === step;
          const isDone = index < step;

          return (
            <div key={label} className={styles.stepItem}>
              <div
                className={`${styles.stepCircle} ${
                  isActive ? styles.stepCircleActive : ""
                } ${isDone ? styles.stepCircleDone : ""}`}
              >
                {isDone ? "✓" : index + 1}
              </div>
              <div>
                <div className={styles.stepLabel}>{label}</div>
                <div className={styles.stepHint}>
                  {index === 0 && "Pregled proizvoda i popust"}
                  {index === 1 && "Podaci za dostavu"}
                  {index === 2 && "Potvrda porudžbine"}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {step === 0 && (
        <section className={styles.grid}>
          <div className={styles.leftCol}>
            <div className={styles.card}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.cardTitle}>Proizvodi u korpi</h2>
                  <p className={styles.cardText}>
                    Trenutno imate {totalItems}{" "}
                    {totalItems === 1 ? "artikal" : "artikla"} u korpi.
                  </p>
                </div>

                <Link href="/shop" className={styles.inlineLink}>
                  Dodaj još
                </Link>
              </div>

              {items.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>👜</div>
                  <h3>Korpa je prazna</h3>
                  <p>
                    Dodajte parfeme u korpu pa se vratite ovde da nastavite
                    kupovinu.
                  </p>
                  <Link href="/shop" className={styles.primaryBtn}>
                    Idi na shop
                  </Link>
                </div>
              ) : (
                <div className={styles.items}>
                  {items.map((item) => (
                    <article
                      key={`${item.id}-${item.ml}`}
                      className={styles.itemRow}
                    >
                      <div className={styles.thumbWrap}>
                        {item.imageUrl ? (
                          <Image
                            className={styles.thumb}
                            src={item.imageUrl}
                            alt={item.name}
                            width={96}
                            height={96}
                            unoptimized
                          />
                        ) : (
                          <div className={styles.thumbPlaceholder}>
                            Bez slike
                          </div>
                        )}
                      </div>

                      <div className={styles.itemMeta}>
                        <div className={styles.itemTop}>
                          <div>
                            <div className={styles.itemBrand}>
                              {item.brand ?? "Dekant"}
                            </div>
                            <h3 className={styles.itemName}>{item.name}</h3>
                          </div>

                          <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => handleRemove(item.id, item.ml)}
                          >
                            Ukloni
                          </button>
                        </div>

                        <div className={styles.metaLine}>
                          {item.ml} ml · {formatRsd(item.priceRsd)} / kom
                        </div>

                        <div className={styles.itemBottom}>
                          <div className={styles.qtyBox}>
                            <button
                              type="button"
                              onClick={() => handleDec(item.id, item.ml)}
                              aria-label="Smanji količinu"
                            >
                              −
                            </button>
                            <span>{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => handleInc(item.id, item.ml)}
                              aria-label="Povećaj količinu"
                            >
                              +
                            </button>
                          </div>

                          <div className={styles.lineTotal}>
                            {formatRsd(item.priceRsd * item.qty)}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.summaryCol}>
            <aside className={styles.summaryCard}>
              <h2 className={styles.cardTitle}>Pregled računa</h2>

              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <strong>{formatRsd(subtotal)}</strong>
                </div>

                <div className={styles.summaryRow}>
                  <span>Popust</span>
                  <strong>{formatRsd(discount)}</strong>
                </div>

                <div className={styles.summaryShipmentBlock}>
                  <span className={styles.summaryShipmentLabel}>Dostava</span>
                  <strong className={styles.summaryShipmentPrice}>
                    Post-express (1-3 radna dana): {formatRsd(shippingCost)}
                  </strong>
                </div>

                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>Ukupno za uplatu</span>
                  <strong>{formatRsd(total)}</strong>
                </div>
              </div>

              <p className={styles.summaryNote}>
                Kupon se automatski uračunava u ukupnu cenu pre checkout koraka.
              </p>

              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!canContinueToCheckout}
                onClick={() => setStep(1)}
              >
                Nastavi na checkout
              </button>
            </aside>

            <div className={styles.card}>
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.cardTitle}>Kupon kod</h2>
                  <p className={styles.cardText}>
                    Unesite promo kod i odmah vidite koliko se račun smanjuje.
                  </p>
                </div>
              </div>

              <div className={styles.couponRow}>
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  className={styles.input}
                  type="text"
                  placeholder="npr. DEKANT10"
                  aria-label="Kupon kod"
                />

                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleApplyCoupon}
                  disabled={couponState === "loading" || !items.length}
                >
                  {couponState === "loading" ? "Proveravam..." : "Primeni"}
                </button>
              </div>

              <div className={styles.progressTrack} aria-hidden="true">
                <span
                  className={styles.progressFill}
                  style={{ width: `${couponProgress}%` }}
                />
              </div>

              {couponMessage && (
                <p
                  className={`${styles.message} ${
                    couponState === "error" ? styles.messageError : ""
                  } ${couponState === "success" ? styles.messageSuccess : ""}`}
                >
                  {couponMessage}
                </p>
              )}

              {appliedCoupon && (
                <div className={styles.couponBadgeRow}>
                  <div className={styles.couponBadge}>
                    <span>{appliedCoupon.code}</span>
                    <small>
                      {appliedCoupon.type === "percent"
                        ? `${appliedCoupon.value}% popusta`
                        : `${formatRsd(appliedCoupon.value)} popusta`}
                    </small>
                  </div>

                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={handleRemoveCoupon}
                  >
                    Ukloni kupon
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className={styles.checkoutWrap}>
          <div className={styles.card}>
            <div className={styles.sectionHead}>
              <div>
                <h2 className={styles.cardTitle}>Podaci za slanje</h2>
                <p className={styles.cardText}>
                  Unesite osnovne podatke za slanje porudžbine.
                </p>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleCheckoutSubmit}>
              {savedAddresses.length > 0 && (
                <>
                  <label className={styles.field}>
                    <span>Sačuvana adresa</span>
                    <select
                      className={styles.input}
                      value={selectedAddressId}
                      onChange={(e) => {
                        const value = e.target.value;

                        if (value === "new") {
                          handleUseNewAddress();
                          return;
                        }

                        handleSelectSavedAddress(value);
                      }}
                      disabled={isLoadingAddresses || isSubmittingOrder}
                    >
                      {savedAddresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.is_default ? "Podrazumevana · " : ""}
                          {address.full_name} — {address.city}, {address.street}
                        </option>
                      ))}

                      <option value="new">Unesi novu adresu</option>
                    </select>
                  </label>

                  <p className={styles.cardText} style={{ marginTop: "-6px" }}>
                    Treba izmena?{" "}
                    <Link href="/addresses" className={styles.inlineLink}>
                      Upravljaj adresama
                    </Link>
                  </p>
                </>
              )}

              {isLoadingAddresses && (
                <p className={styles.cardText}>Učitavamo sačuvane adrese...</p>
              )}

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Ime i prezime</span>
                  <input
                    required
                    className={styles.input}
                    value={checkoutForm.fullName}
                    onChange={(e) => updateShippingField("fullName", e.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Email</span>
                  <input
                    required
                    type="email"
                    className={styles.input}
                    value={checkoutForm.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Telefon</span>
                  <input
                    required
                    className={styles.input}
                    value={checkoutForm.phone}
                    onChange={(e) => updateShippingField("phone", e.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Grad</span>
                  <input
                    required
                    className={styles.input}
                    value={checkoutForm.city}
                    onChange={(e) => updateShippingField("city", e.target.value)}
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>Adresa</span>
                <input
                  required
                  className={styles.input}
                  value={checkoutForm.address}
                  onChange={(e) => updateShippingField("address", e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span>Napomena</span>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={checkoutForm.note}
                  onChange={(e) => updateShippingField("note", e.target.value)}
                  placeholder="Npr. pozvati pre dostave"
                />
              </label>

              <div className={styles.checkoutActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setStep(0)}
                >
                  Nazad na korpu
                </button>

                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={isSubmittingOrder || !items.length}
                >
                  {isSubmittingOrder ? "Obrađujemo..." : "Potvrdi porudžbinu"}
                </button>
              </div>
            </form>
          </div>

          <aside className={styles.summaryCard}>
            <h2 className={styles.cardTitle}>Sažetak</h2>

            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span>Stavke u korpi</span>
                <strong>{totalItems}</strong>
              </div>

              <div className={styles.summaryRow}>
                <span>Ukupna količina</span>
                <strong>{totalQty}</strong>
              </div>

              <div className={styles.summaryRow}>
                <span>Kupon</span>
                <strong>{appliedCoupon ? appliedCoupon.code : "Nema"}</strong>
              </div>

              <div className={styles.summaryRow}>
                <span>Ukupan popust</span>
                <strong>{formatRsd(discount)}</strong>
              </div>

              <div className={styles.summaryShipmentBlock}>
                <span className={styles.summaryShipmentLabel}>Dostava</span>
                <strong className={styles.summaryShipmentPrice}>
                  Post-express (1-3 radna dana): {formatRsd(shippingCost)}
                </strong>
              </div>

              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Za uplatu</span>
                <strong>{formatRsd(total)}</strong>
              </div>
            </div>
          </aside>
        </section>
      )}

      {step === 2 && (
        <section className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <p className={styles.eyebrow}>Porudžbina poslata</p>
          <h2 className={styles.cardTitle}>Uspešno ste poručili</h2>
          <p className={styles.successText}>
            Hvala na poverenju. Vaša porudžbina je evidentirana i uskoro ćete
            dobiti potvrdu sa detaljima.
          </p>

          <div className={styles.orderBox}>
            Broj porudžbine: <strong>{orderNumber}</strong>
          </div>

          <div className={styles.successActions}>
            <Link href="/shop" className={styles.primaryBtn}>
              Vrati se na shop
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
