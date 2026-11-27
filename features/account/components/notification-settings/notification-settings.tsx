"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiBell, FiCheckCircle } from "react-icons/fi";
import { createClient } from "@/db/clients/browser";
import { fetchCatalog } from "@/features/shop/client/catalog.api";
import {
  cancelStockAlert,
  readMyStockAlerts,
  type StockAlert,
} from "@/features/stock-alerts/client/stock-alerts.api";
import cardStyles from "../settings-page/settings-page.module.css";
import styles from "./notification-settings.module.css";

type MarketingState = { status: "loading" } | { status: "unavailable" } | { status: "ready"; optIn: boolean };

/**
 * Emails the customer gets: order emails (always), news and offers (consent saved in the profile,
 * the time is recorded by the database) and their "Javi mi kad bude na stanju" alerts.
 */
export default function NotificationSettings({ userId }: { userId: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [marketing, setMarketing] = useState<MarketingState>({ status: "loading" });
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[] | null>(null);
  const [names, setNames] = useState<Map<string, { name: string; brand: string }>>(new Map());
  const [cancelling, setCancelling] = useState<string | null>(null);

  // News and offers consent from the profile (before migration 017 the column doesn't exist: hidden).
  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    void supabase
      .from("profiles")
      .select("marketing_opt_in")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMarketing({ status: "unavailable" });
          return;
        }
        setMarketing({ status: "ready", optIn: Boolean((data as { marketing_opt_in?: boolean } | null)?.marketing_opt_in) });
      });
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  const loadAlerts = useCallback(async () => {
    const list = await readMyStockAlerts();
    setAlerts(list);
    if (list.length) {
      const catalog = await fetchCatalog();
      setNames(new Map(catalog.map((product) => [product.id, { name: product.name, brand: product.brand }])));
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void readMyStockAlerts().then(async (list) => {
      if (!active) return;
      setAlerts(list);
      if (!list.length) return;
      const catalog = await fetchCatalog();
      if (active) setNames(new Map(catalog.map((product) => [product.id, { name: product.name, brand: product.brand }])));
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function toggleMarketing(optIn: boolean) {
    if (!supabase || !userId || marketing.status !== "ready") return;
    setSavingMarketing(true);
    setMessage(null);
    const { error } = await supabase.from("profiles").update({ marketing_opt_in: optIn }).eq("id", userId);
    setSavingMarketing(false);
    if (error) {
      setMessage({ tone: "error", text: "Podešavanje nije sačuvano. Pokušaj ponovo." });
      return;
    }
    setMarketing({ status: "ready", optIn });
    setMessage({
      tone: "ok",
      text: optIn ? "Prijavljen/a si na novosti i akcije." : "Odjavljen/a si sa novosti i akcija.",
    });
  }

  async function cancel(alert: StockAlert) {
    setCancelling(alert.id);
    const ok = await cancelStockAlert(alert.id);
    setCancelling(null);
    if (!ok) {
      setMessage({ tone: "error", text: "Obaveštenje nije otkazano. Pokušaj ponovo." });
      return;
    }
    await loadAlerts();
  }

  return (
    <section className={cardStyles.card}>
      <div className={cardStyles.cardHeader}>
        <div className={cardStyles.cardIcon}>
          <FiBell />
        </div>

        <div>
          <div className={cardStyles.cardKicker}>Obaveštenja</div>
          <h2 className={cardStyles.cardTitle}>Mejlovi koje dobijaš</h2>
          <p className={cardStyles.cardText}>
            Biraš šta ti šaljemo. Mejlovi o porudžbini stižu uvek, jer su deo kupovine.
          </p>
        </div>
      </div>

      <div className={cardStyles.preferenceList}>
        <div className={cardStyles.preferenceRow}>
          <div>
            <div className={cardStyles.preferenceTitle}>Obaveštenja o porudžbini</div>
            <div className={cardStyles.preferenceText}>
              Potvrda, slanje (sa brojem pošiljke) i otkazivanje porudžbine.
            </div>
          </div>
          <span className={styles.alwaysOn}>Uvek</span>
        </div>

        {marketing.status !== "unavailable" && (
          <label className={cardStyles.preferenceRow}>
            <div>
              <div className={cardStyles.preferenceTitle}>Novosti i akcije</div>
              <div className={cardStyles.preferenceText}>
                Povremeno: novi parfemi, paketi i popusti. Odjava je jedan klik, ovde.
              </div>
            </div>
            <input
              className={cardStyles.switch}
              type="checkbox"
              checked={marketing.status === "ready" && marketing.optIn}
              disabled={marketing.status !== "ready" || savingMarketing}
              onChange={(event) => void toggleMarketing(event.target.checked)}
            />
          </label>
        )}
      </div>

      {message && (
        <div className={message.tone === "ok" ? cardStyles.successInline : cardStyles.helperText} role="status">
          {message.tone === "ok" && <FiCheckCircle />}
          <span>{message.text}</span>
        </div>
      )}

      <div className={styles.alerts}>
        <div className={cardStyles.preferenceTitle}>Javi mi kad bude na stanju</div>
        {alerts === null ? (
          <p className={styles.muted}>Učitavanje…</p>
        ) : alerts.length === 0 ? (
          <p className={styles.muted}>
            Nemaš aktivna obaveštenja. Na stranici parfema koji nije na stanju klikni „Javi mi kad bude na stanju” i
            poslaćemo ti mejl čim stigne.
          </p>
        ) : (
          <ul className={styles.alertList}>
            {alerts.map((alert) => {
              const info = names.get(alert.perfumeId);
              return (
                <li key={alert.id} className={styles.alertRow}>
                  <div className={styles.alertText}>
                    <Link href={`/shop/${encodeURIComponent(alert.perfumeId)}`} className={styles.alertName}>
                      {info ? `${info.brand} ${info.name}` : alert.perfumeId}
                    </Link>
                    <span className={styles.muted}>{alert.ml ? `${alert.ml} ml` : "bilo koja zapremina"}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.cancel}
                    onClick={() => void cancel(alert)}
                    disabled={cancelling === alert.id}
                  >
                    {cancelling === alert.id ? "…" : "Otkaži"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
