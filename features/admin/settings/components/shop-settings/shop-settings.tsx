"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PiCheckCircle, PiEye, PiTruck, PiWarningCircle } from "react-icons/pi";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import ui from "@/features/admin/ui/admin-ui.module.css";
import { describeShipping, shippingFor } from "@/features/orders/lib/shipping";
import { formatRsd } from "@/lib/format";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";
import styles from "./shop-settings.module.css";

/** Sample cart totals for the "what customers see" preview. */
const EXAMPLE_TOTALS = [2500, 4800, 7600];

/** Admin > Settings: shipping price and free-shipping threshold. */
export default function ShopSettingsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shipping, setShipping] = useState("");
  const [freeEnabled, setFreeEnabled] = useState(true);
  const [freeFrom, setFreeFrom] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return router.replace("/login?next=/admin/podesavanja");
        if (response.status === 403) return router.replace("/");
        const data = (await readJsonSafe(response)) as { shippingRsd?: number; freeShippingFromRsd?: number | null } | null;
        setShipping(String(data?.shippingRsd ?? 580));
        setFreeEnabled(Boolean(data?.freeShippingFromRsd));
        setFreeFrom(String(data?.freeShippingFromRsd ?? 5000));
      })
      .catch(() => setNotice({ tone: "error", text: "Podešavanja nisu učitana." }))
      .finally(() => setLoading(false));
  }, [router]);

  const shippingRsd = Number(shipping);
  const freeShippingFromRsd = freeEnabled && freeFrom ? Number(freeFrom) : null;
  const valid = shipping !== "" && Number.isInteger(shippingRsd) && shippingRsd >= 0 && (freeShippingFromRsd === null || freeShippingFromRsd > 0);

  async function save() {
    if (!valid) {
      setNotice({ tone: "error", text: "Proveri iznose (celi brojevi)." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingRsd, freeShippingFromRsd }),
      });
      const data = await readJsonSafe(response);
      if (!response.ok) throw new Error(resolveErrorMessage(data, "Čuvanje nije uspelo."));
      setNotice({ tone: "ok", text: "Sačuvano — korpa, stranica Dostava i AI savetnik odmah koriste nove iznose." });
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <AdminPageHeader title="Podešavanja" subtitle="Cena dostave i besplatna dostava — važi odmah za korpu, checkout i stranicu Dostava." />
  );

  if (loading) {
    return (
      <>
        {header}
        <div className={ui.loading}>Učitavanje…</div>
      </>
    );
  }

  return (
    <>
      {header}

      <div className={styles.grid}>
        <section className={`${ui.panel} ${styles.form}`}>
          <div className={ui.panelHead}>
            <div className={ui.panelTitleRow}>
              <span className={ui.panelIcon} aria-hidden="true">
                <PiTruck />
              </span>
              <h2 className={ui.panelTitle}>Dostava</h2>
            </div>
          </div>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Cena dostave</span>
            <span className={`${ui.inputSuffix} ${styles.amount}`}>
              <input
                className={ui.input}
                inputMode="numeric"
                value={shipping}
                onChange={(e) => setShipping(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="580"
              />
              <span>rsd</span>
            </span>
            <span className={ui.hint}>0 = dostava je uvek besplatna.</span>
          </label>

          <label className={ui.switchRow}>
            <span className={ui.switchText}>
              Besplatna dostava iznad iznosa
              <small>U korpi se prikazuje traka „Još X rsd do besplatne dostave”.</small>
            </span>
            <input
              type="checkbox"
              className={ui.switch}
              checked={freeEnabled}
              onChange={(e) => setFreeEnabled(e.target.checked)}
            />
          </label>

          {freeEnabled && (
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Besplatna dostava od</span>
              <span className={`${ui.inputSuffix} ${styles.amount}`}>
                <input
                  className={ui.input}
                  inputMode="numeric"
                  value={freeFrom}
                  onChange={(e) => setFreeFrom(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="5000"
                />
                <span>rsd</span>
              </span>
              <span className={ui.hint}>Računa se na iznos proizvoda posle popusta.</span>
            </label>
          )}

          <div className={styles.actions}>
            <button type="button" className={ui.btnPrimary} disabled={saving || !valid} onClick={() => void save()}>
              {saving ? "Čuvam…" : "Sačuvaj"}
            </button>
          </div>

          {notice && (
            <div className={`${ui.notice} ${notice.tone === "error" ? ui.noticeError : ""}`} role="status">
              {notice.tone === "error" ? <PiWarningCircle aria-hidden="true" /> : <PiCheckCircle aria-hidden="true" />}
              {notice.text}
            </div>
          )}
        </section>

        <aside className={`${ui.panel} ${styles.preview}`}>
          <div className={ui.panelHead}>
            <div className={ui.panelTitleRow}>
              <span className={ui.panelIcon} aria-hidden="true">
                <PiEye />
              </span>
              <h2 className={ui.panelTitle}>Šta kupci vide</h2>
            </div>
          </div>

          {valid ? (
            <>
              <p className={styles.previewLead}>Dostava {describeShipping({ shippingRsd, freeShippingFromRsd })}.</p>
              <ul className={styles.examples}>
                {EXAMPLE_TOTALS.map((total) => {
                  const cost = shippingFor(1, total, { shippingRsd, freeShippingFromRsd });
                  return (
                    <li key={total}>
                      <span>Korpa {formatRsd(total)}</span>
                      <strong className={cost === 0 ? styles.free : ""}>
                        {cost === 0 ? "besplatna dostava" : `+ ${formatRsd(cost)}`}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className={ui.hint}>Unesi ispravne iznose da vidiš pregled.</p>
          )}
        </aside>
      </div>
    </>
  );
}
