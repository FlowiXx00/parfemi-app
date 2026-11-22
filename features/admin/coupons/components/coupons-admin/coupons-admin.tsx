"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PiCheckCircle, PiPlus, PiTicket, PiWarningCircle } from "react-icons/pi";
import {
  COUPON_STATUS_LABELS,
  couponStatus,
  describeCoupon,
  type CouponRow,
  type CouponStatus,
} from "@/features/orders/lib/coupons";
import { formatDateTime } from "@/lib/format";
import { AdminCouponsApiError, fetchCoupons, removeCoupon, saveCoupon } from "../../client/coupons.api";
import {
  couponToForm,
  emptyCouponForm,
  formToPayload,
  generateCouponCode,
  validateCouponPayload,
  type CouponFormState,
} from "../../lib/coupon-form";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import ui from "@/features/admin/ui/admin-ui.module.css";
import styles from "./coupons-admin.module.css";

const STATUS_CLASS: Record<CouponStatus, string> = {
  active: "statusActive",
  off: "statusOff",
  scheduled: "statusScheduled",
  expired: "statusOff",
  used_up: "statusOff",
};

function validity(row: CouponRow) {
  if (row.starts_at && row.expires_at) return `${formatDateTime(row.starts_at)} – ${formatDateTime(row.expires_at)}`;
  if (row.expires_at) return `do ${formatDateTime(row.expires_at)}`;
  if (row.starts_at) return `od ${formatDateTime(row.starts_at)}`;
  return "bez roka";
}

export default function CouponsAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(emptyCouponForm);

  const handleError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof AdminCouponsApiError && error.status === 401) return router.replace("/login?next=/admin/kuponi");
      if (error instanceof AdminCouponsApiError && error.status === 403) return router.replace("/");
      setNotice({ tone: "error", text: (error as Error).message || fallback });
    },
    [router]
  );

  /** Reload after a change. */
  const load = useCallback(async () => {
    try {
      setRows(await fetchCoupons());
    } catch (error) {
      handleError(error, "Kuponi nisu učitani.");
    }
  }, [handleError]);

  // Initial load (state is set only once the response arrives).
  useEffect(() => {
    fetchCoupons()
      .then(setRows)
      .catch((error: unknown) => handleError(error, "Kuponi nisu učitani."))
      .finally(() => setLoading(false));
  }, [handleError]);

  const counts = useMemo(() => {
    const active = rows.filter((row) => couponStatus(row) === "active").length;
    return { active, total: rows.length, uses: rows.reduce((sum, row) => sum + row.used_count, 0) };
  }, [rows]);

  const setField = <K extends keyof CouponFormState>(key: K, value: CouponFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function startNew() {
    setEditingCode(null);
    setForm(emptyCouponForm());
    setNotice(null);
  }

  function startEdit(row: CouponRow) {
    setEditingCode(row.code);
    setForm(couponToForm(row));
    setNotice(null);
  }

  async function onSave() {
    let payload;
    try {
      payload = formToPayload(form);
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message });
      return;
    }
    setSaving(true);
    try {
      await saveCoupon(payload, editingCode ?? undefined);
      await load();
      setEditingCode(payload.code);
      setNotice({ tone: "ok", text: `Kupon ${payload.code} je sačuvan${payload.is_active ? "" : " (ugašen)"}.` });
    } catch (error) {
      handleError(error, "Čuvanje nije uspelo.");
    } finally {
      setSaving(false);
    }
  }

  /** Quick on/off from the list (all other fields stay the same). */
  async function toggle(row: CouponRow) {
    setSaving(true);
    try {
      const payload = validateCouponPayload({ ...row, is_active: !row.is_active });
      await saveCoupon(payload, row.code);
      await load();
      if (editingCode === row.code) setField("isActive", !row.is_active);
      setNotice({ tone: "ok", text: `${row.code} je ${row.is_active ? "ugašen" : "uključen"}.` });
    } catch (error) {
      handleError(error, "Promena nije uspela.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: CouponRow) {
    const used = row.used_count > 0 ? ` Iskorišćen je ${row.used_count}×; porudžbine zadržavaju popust.` : "";
    if (!confirm(`Obrisati kupon ${row.code}?${used}\n\nAko samo želiš da prestane da važi, bolje ga ugasi.`)) return;
    setSaving(true);
    try {
      await removeCoupon(row.code);
      await load();
      if (editingCode === row.code) startNew();
      setNotice({ tone: "ok", text: `Kupon ${row.code} je obrisan.` });
    } catch (error) {
      handleError(error, "Brisanje nije uspelo.");
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <AdminPageHeader
      title="Kuponi"
      subtitle="Promo kodovi koje kupci upisuju u korpi. Upotreba se broji kad pošalju porudžbinu."
      actions={
        <button type="button" className={ui.btnPrimary} onClick={startNew}>
          <PiPlus aria-hidden="true" /> Novi kupon
        </button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <div className={ui.loading}>Učitavanje kupona…</div>
      </>
    );
  }

  const preview = (() => {
    const value = Number(form.value);
    if (!(value > 0)) return "";
    const parts = [describeCoupon({ type: form.type, value })];
    if (Number(form.minSubtotal) > 0) parts.push(`za korpu od ${Number(form.minSubtotal).toLocaleString("sr-RS")} rsd`);
    if (Number(form.maxUses) > 0) parts.push(`najviše ${form.maxUses}×`);
    if (form.expiresAt) parts.push(`do ${formatDateTime(new Date(form.expiresAt).toISOString())}`);
    return parts.join(" · ");
  })();

  return (
    <>
      {header}

      <div className={styles.stats}>
        <div className={`${ui.panel} ${styles.stat}`}>
          <span>Aktivni</span>
          <strong>{counts.active}</strong>
        </div>
        <div className={`${ui.panel} ${styles.stat}`}>
          <span>Ukupno kupona</span>
          <strong>{counts.total}</strong>
        </div>
        <div className={`${ui.panel} ${styles.stat}`}>
          <span>Iskorišćeno puta</span>
          <strong>{counts.uses}</strong>
        </div>
      </div>

      {notice && (
        <div className={`${ui.notice} ${notice.tone === "error" ? ui.noticeError : ""} ${styles.notice}`} role="status">
          {notice.tone === "error" ? <PiWarningCircle aria-hidden="true" /> : <PiCheckCircle aria-hidden="true" />}
          {notice.text}
        </div>
      )}

      <div className={styles.grid}>
        {/* -------- Lista -------- */}
        <section className={`${ui.panel} ${styles.listPanel}`} aria-label="Kuponi">
          <div className={ui.panelHead}>
            <h2 className={ui.panelTitle}>Svi kuponi</h2>
          </div>

          {rows.length === 0 && <div className={ui.empty}>Još nema kupona. Napravi prvi desno.</div>}

          <div className={styles.list}>
            {rows.map((row) => {
              const status = couponStatus(row);
              return (
                <article
                  key={row.code}
                  className={`${styles.item} ${editingCode === row.code ? styles.itemActive : ""} ${
                    status === "active" ? "" : styles.itemMuted
                  }`}
                >
                  <button type="button" className={styles.itemMain} onClick={() => startEdit(row)}>
                    <span className={styles.ticket}>
                      <PiTicket aria-hidden="true" />
                      {row.code}
                    </span>
                    <span className={styles.itemInfo}>
                      <span className={styles.itemValue}>
                        {describeCoupon(row)}
                        {row.min_subtotal_rsd ? ` · od ${row.min_subtotal_rsd.toLocaleString("sr-RS")} rsd` : ""}
                      </span>
                      <span className={styles.itemMeta}>
                        {row.label ? `${row.label} · ` : ""}
                        {validity(row)} · iskorišćeno {row.used_count}
                        {row.max_uses ? ` / ${row.max_uses}` : "×"}
                      </span>
                    </span>
                    <span className={`${styles.status} ${styles[STATUS_CLASS[status]]}`}>
                      {COUPON_STATUS_LABELS[status]}
                    </span>
                  </button>
                  <div className={styles.itemActions}>
                    <label className={styles.toggle} title={row.is_active ? "Ugasi kupon" : "Uključi kupon"}>
                      <input
                        type="checkbox"
                        className={ui.switch}
                        checked={row.is_active}
                        disabled={saving}
                        onChange={() => void toggle(row)}
                        aria-label={row.is_active ? `Ugasi ${row.code}` : `Uključi ${row.code}`}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      disabled={saving}
                      onClick={() => void onDelete(row)}
                    >
                      Obriši
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* -------- Forma -------- */}
        <section
          className={`${ui.panel} ${styles.form}`}
          aria-label={editingCode ? `Izmena kupona ${editingCode}` : "Novi kupon"}
        >
          <div className={ui.panelHead}>
            <div className={ui.panelTitleRow}>
              <span className={ui.panelIcon} aria-hidden="true">
                <PiTicket />
              </span>
              <h2 className={ui.panelTitle}>{editingCode ? `Izmena: ${editingCode}` : "Novi kupon"}</h2>
            </div>
          </div>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Kod koji kupac upisuje</span>
            <div className={styles.inline}>
              <input
                className={`${ui.input} ${styles.codeInput}`}
                value={form.code}
                onChange={(e) => setField("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder="npr. LETO15"
                maxLength={30}
                autoComplete="off"
              />
              <button type="button" className={ui.btn} onClick={() => setField("code", generateCouponCode())}>
                Generiši
              </button>
            </div>
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Opis (vidi kupac posle primene)</span>
            <input
              className={ui.input}
              value={form.label}
              onChange={(e) => setField("label", e.target.value)}
              placeholder="npr. Letnja akcija"
              maxLength={80}
            />
          </label>

          <div className={styles.row}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Vrsta popusta</span>
              <select
                className={ui.select}
                value={form.type}
                onChange={(e) => setField("type", e.target.value === "fixed" ? "fixed" : "percent")}
              >
                <option value="percent">Procenat (%)</option>
                <option value="fixed">Fiksni iznos (rsd)</option>
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>{form.type === "percent" ? "Popust (%)" : "Popust (rsd)"}</span>
              <input
                className={ui.input}
                inputMode="numeric"
                value={form.value}
                onChange={(e) => setField("value", e.target.value.replace(/[^\d]/g, ""))}
                placeholder={form.type === "percent" ? "10" : "500"}
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Minimalna korpa (rsd)</span>
              <input
                className={ui.input}
                inputMode="numeric"
                value={form.minSubtotal}
                onChange={(e) => setField("minSubtotal", e.target.value.replace(/[^\d]/g, ""))}
                placeholder="bez minimuma"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Najviše upotreba</span>
              <input
                className={ui.input}
                inputMode="numeric"
                value={form.maxUses}
                onChange={(e) => setField("maxUses", e.target.value.replace(/[^\d]/g, ""))}
                placeholder="neograničeno"
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Važi od</span>
              <input
                className={ui.input}
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setField("startsAt", e.target.value)}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Važi do</span>
              <input
                className={ui.input}
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setField("expiresAt", e.target.value)}
              />
            </label>
          </div>

          <label className={ui.switchRow}>
            <span className={ui.switchText}>
              Aktivan
              <small>Kupci mogu da ga koriste.</small>
            </span>
            <input
              type="checkbox"
              className={ui.switch}
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
            />
          </label>

          {preview && <p className={styles.preview}>Kupac dobija: {preview}</p>}

          <div className={styles.formActions}>
            <button type="button" className={ui.btnPrimary} disabled={saving} onClick={() => void onSave()}>
              {saving ? "Čuvam…" : editingCode ? "Sačuvaj izmene" : "Napravi kupon"}
            </button>
            {editingCode && (
              <button type="button" className={ui.btn} onClick={startNew}>
                Otkaži
              </button>
            )}
          </div>

          <p className={ui.hint}>
            Prazna polja znače „bez ograničenja”. Dva kupca ne mogu istovremeno da potroše poslednju upotrebu.
          </p>
        </section>
      </div>
    </>
  );
}