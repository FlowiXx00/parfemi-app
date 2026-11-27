"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiBell, FiCheck } from "react-icons/fi";
import {
  cancelStockAlert,
  createStockAlert,
  readMyStockAlerts,
  type StockAlert,
} from "@/features/stock-alerts/client/stock-alerts.api";
import { unavailableVolumes } from "@/features/stock-alerts/lib/alerts";
import styles from "./stock-alert-button.module.css";

type Option = { key: string; ml: number | null; label: string };

/**
 * "Javi mi kad bude na stanju" for volumes that aren't available. Everything sold out = one button
 * for the whole perfume; some volumes sold out = one button per volume. Signed-out visitors are sent
 * to sign in first (the email goes to their account).
 */
export default function StockAlertButton({
  productId,
  variants,
  isLoggedIn,
  sessionReady,
  compact = false,
}: {
  productId: string;
  variants: { ml: number; inStock: boolean }[];
  isLoggedIn: boolean;
  sessionReady: boolean;
  /** Smaller version without the lead text (wishlist cards). */
  compact?: boolean;
}) {
  const router = useRouter();
  const missing = useMemo(() => unavailableVolumes(variants), [variants]);
  const allMissing = missing.length > 0 && missing.length === variants.length;
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setAlerts(await readMyStockAlerts(productId));
  }, [productId]);

  useEffect(() => {
    if (!sessionReady || !isLoggedIn || !missing.length) return;
    let active = true;
    const load = () => {
      void readMyStockAlerts(productId).then((list) => {
        if (active) setAlerts(list);
      });
    };
    load();
    window.addEventListener("stock-alerts:updated", load);
    return () => {
      active = false;
      window.removeEventListener("stock-alerts:updated", load);
    };
  }, [sessionReady, isLoggedIn, productId, missing.length]);

  if (!missing.length) return null;

  const options: Option[] = allMissing
    ? [{ key: "all", ml: null, label: "Javi mi kad bude na stanju" }]
    : missing.map((ml) => ({ key: String(ml), ml, label: `Javi mi za ${ml} ml` }));

  const shown = isLoggedIn ? alerts : [];
  const wholePerfume = shown.find((alert) => alert.ml === null);
  const alertFor = (option: Option) => (option.ml === null ? wholePerfume : (shown.find((alert) => alert.ml === option.ml) ?? wholePerfume));

  async function subscribe(option: Option) {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/shop/${productId}`)}`);
      return;
    }
    setBusy(option.key);
    setError("");
    const result = await createStockAlert(productId, option.ml);
    if (!result.ok) setError(result.error);
    await reload();
    setBusy(null);
  }

  async function cancel(option: Option, alert: StockAlert) {
    setBusy(option.key);
    setError("");
    if (!(await cancelStockAlert(alert.id))) setError("Obaveštenje nije otkazano. Pokušaj ponovo.");
    await reload();
    setBusy(null);
  }

  return (
    <div className={compact ? styles.compact : styles.box}>
      {!compact && (
        <span className={styles.lead}>
          {allMissing ? "Trenutno nema na stanju." : `Nema na stanju: ${missing.join(", ")} ml.`}
        </span>
      )}
      <div className={styles.options}>
        {options.map((option) => {
          const alert = alertFor(option);
          return alert ? (
            <span key={option.key} className={styles.active}>
              <FiCheck aria-hidden="true" />
              Javićemo ti mejlom{option.ml !== null && alert.ml !== null ? ` (${option.ml} ml)` : ""}
              <button
                type="button"
                className={styles.cancel}
                onClick={() => void cancel(option, alert)}
                disabled={busy === option.key}
              >
                Otkaži
              </button>
            </span>
          ) : (
            <button
              key={option.key}
              type="button"
              className={styles.button}
              onClick={() => void subscribe(option)}
              disabled={busy === option.key}
            >
              <FiBell aria-hidden="true" />
              {busy === option.key ? "Čuvamo…" : option.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
