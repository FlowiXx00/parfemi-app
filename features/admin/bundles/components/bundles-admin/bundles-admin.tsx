"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PiCheckCircle, PiGift, PiMagnifyingGlass, PiPlus, PiWarningCircle, PiX } from "react-icons/pi";
import { AdminPerfumesApiError, fetchAdminPerfumes } from "@/features/admin/perfumes/client/perfumes.api";
import type { PerfumeAdminRow } from "@/features/admin/perfumes/types";
import { priceBundle, type BundleRow } from "@/features/bundles/lib/bundles";
import { BUNDLE_ML_OPTIONS, bundleSlug, validateBundle } from "@/features/bundles/lib/validate-bundle";
import { formatRsd, normalizeText } from "@/lib/format";
import { readJsonSafe, resolveErrorMessage } from "@/lib/http";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import ui from "@/features/admin/ui/admin-ui.module.css";
import styles from "./bundles-admin.module.css";

type FormState = {
  id: string;
  title: string;
  description: string;
  ml: number;
  discount: string;
  perfumeIds: string[];
  isActive: boolean;
  sortOrder: string;
};

const emptyForm = (): FormState => ({
  id: "",
  title: "",
  description: "",
  ml: 5,
  discount: "15",
  perfumeIds: [],
  isActive: true,
  sortOrder: "0",
});

const bundleToForm = (bundle: BundleRow): FormState => ({
  id: bundle.id,
  title: bundle.title,
  description: bundle.description,
  ml: bundle.ml,
  discount: String(bundle.discount_pct),
  perfumeIds: bundle.perfume_ids,
  isActive: bundle.is_active,
  sortOrder: String(bundle.sort_order),
});

/** Admin perfume row -> shape used for bundle pricing (takes stock into account). */
const toPricing = (p: PerfumeAdminRow) => ({
  id: p.id,
  variants: p.variants.map((v) => ({
    ml: Number(v.ml),
    priceRsd: Number(v.price_rsd),
    inStock: v.in_stock && p.is_active && (p.stock_ml === null || p.stock_ml >= Number(v.ml)),
  })),
});

async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const data = await readJsonSafe(response);
  if (!response.ok) throw new AdminPerfumesApiError(response.status, resolveErrorMessage(data, "Greška."));
  return data as T;
}

export default function BundlesAdmin() {
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [perfumes, setPerfumes] = useState<PerfumeAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof AdminPerfumesApiError && error.status === 401) return router.replace("/login?next=/admin/paketi");
      if (error instanceof AdminPerfumesApiError && error.status === 403) return router.replace("/");
      setNotice({ tone: "error", text: (error as Error).message || "Greška." });
    },
    [router]
  );

  const reloadBundles = useCallback(async () => {
    const data = await api<{ bundles?: BundleRow[] }>("/api/admin/bundles");
    setBundles(Array.isArray(data.bundles) ? data.bundles : []);
  }, []);

  useEffect(() => {
    Promise.all([api<{ bundles?: BundleRow[] }>("/api/admin/bundles"), fetchAdminPerfumes()])
      .then(([data, rows]) => {
        setBundles(Array.isArray(data.bundles) ? data.bundles : []);
        setPerfumes(rows);
      })
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [handleError]);

  const byId = useMemo(() => new Map(perfumes.map((p) => [p.id, p])), [perfumes]);
  const pricing = useMemo(() => perfumes.map(toPricing), [perfumes]);

  const results = useMemo(() => {
    const needle = normalizeText(search.trim());
    if (needle.length < 2) return [];
    return perfumes
      .filter((p) => !form.perfumeIds.includes(p.id) && normalizeText(`${p.brand} ${p.name}`).includes(needle))
      .slice(0, 8);
  }, [perfumes, search, form.perfumeIds]);

  const preview = priceBundle(form.perfumeIds, pricing, form.ml, Number(form.discount) || 0);
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function edit(bundle: BundleRow) {
    setEditingId(bundle.id);
    setForm(bundleToForm(bundle));
    setNotice(null);
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
    setNotice(null);
  }

  /** override: quick toggle from the list (on/off) without waiting for the form to update. */
  async function save(override?: Partial<FormState>, originalId: string | null = editingId) {
    const current = { ...form, ...override };
    let row: BundleRow;
    try {
      row = validateBundle({
        id: current.id || bundleSlug(current.title),
        title: current.title,
        description: current.description,
        ml: current.ml,
        discount_pct: Number(current.discount),
        perfume_ids: current.perfumeIds,
        is_active: current.isActive,
        sort_order: Number(current.sortOrder),
      });
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message });
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle: row, originalId }),
      });
      await reloadBundles();
      setEditingId(row.id);
      setForm((prev) => ({ ...prev, ...override, id: row.id }));
      setNotice({ tone: "ok", text: `Paket „${row.title}” je sačuvan${row.is_active ? " i vidi se na stranici Paketi" : " (ugašen)"}.` });
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function remove(bundle: BundleRow) {
    if (!confirm(`Obrisati paket „${bundle.title}”? Ako samo želiš da ga skloniš, bolje ga ugasi.`)) return;
    setSaving(true);
    try {
      await api(`/api/admin/bundles?id=${encodeURIComponent(bundle.id)}`, { method: "DELETE" });
      await reloadBundles();
      if (editingId === bundle.id) startNew();
      setNotice({ tone: "ok", text: `Paket „${bundle.title}” je obrisan.` });
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <AdminPageHeader
      title="Paketi za probu"
      subtitle="Više dekanata iste zapremine uz popust. Cena se računa sama iz aktuelnih cena parfema."
      actions={
        <button type="button" className={ui.btnPrimary} onClick={startNew}>
          <PiPlus aria-hidden="true" /> Novi paket
        </button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <div className={ui.loading}>Učitavanje paketa…</div>
      </>
    );
  }

  return (
    <>
      {header}

      {notice && (
        <div className={`${ui.notice} ${notice.tone === "error" ? ui.noticeError : ""} ${styles.notice}`} role="status">
          {notice.tone === "error" ? <PiWarningCircle aria-hidden="true" /> : <PiCheckCircle aria-hidden="true" />}
          {notice.text}
        </div>
      )}

      <div className={styles.grid}>
        <section className={`${ui.panel} ${styles.listPanel}`} aria-label="Paketi">
          <div className={ui.panelHead}>
            <h2 className={ui.panelTitle}>Svi paketi</h2>
            <span className={ui.hint}>
              {bundles.filter((bundle) => bundle.is_active).length} aktivnih od {bundles.length}
            </span>
          </div>

          {bundles.length === 0 && (
            <div className={ui.empty}>
              Još nema paketa. Primer: „Top 5 muških” — 5 najpopularnijih muških parfema po 5 ml, 15% jeftinije.
            </div>
          )}

          <div className={styles.list}>
            {bundles.map((bundle) => {
              const priced = priceBundle(bundle.perfume_ids, pricing, bundle.ml, bundle.discount_pct);
              return (
                <article
                  key={bundle.id}
                  className={`${styles.item} ${editingId === bundle.id ? styles.itemActive : ""} ${bundle.is_active ? "" : styles.itemMuted}`}
                >
                  <button type="button" className={styles.itemMain} onClick={() => edit(bundle)}>
                    <span className={styles.itemIcon} aria-hidden="true">
                      <PiGift />
                    </span>
                    <span className={styles.itemInfo}>
                      <span className={styles.itemTop}>
                        <strong>{bundle.title}</strong>
                        <span className={`${styles.status} ${bundle.is_active && priced.available ? styles.statusOn : styles.statusOff}`}>
                          {!bundle.is_active ? "Ugašen" : priced.available ? "U prodaji" : "Nedostupan"}
                        </span>
                      </span>
                      <span className={styles.itemMeta}>
                        {bundle.perfume_ids.length} × {bundle.ml} ml · −{bundle.discount_pct}% ·{" "}
                        <s>{formatRsd(priced.regular)}</s> <strong>{formatRsd(priced.price)}</strong>
                      </span>
                      {!priced.available && bundle.is_active && (
                        <span className={styles.itemWarn}>
                          Nema na stanju: {priced.missing.map((id) => byId.get(id)?.name ?? id).join(", ")}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className={styles.itemActions}>
                    <input
                      type="checkbox"
                      className={ui.switch}
                      checked={bundle.is_active}
                      disabled={saving}
                      aria-label={bundle.is_active ? `Ugasi ${bundle.title}` : `Uključi ${bundle.title}`}
                      onChange={() => {
                        edit(bundle);
                        void save({ ...bundleToForm(bundle), isActive: !bundle.is_active }, bundle.id);
                      }}
                    />
                    <button type="button" className={styles.deleteBtn} disabled={saving} onClick={() => void remove(bundle)}>
                      Obriši
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={`${ui.panel} ${styles.form}`} aria-label={editingId ? "Izmena paketa" : "Novi paket"}>
          <div className={ui.panelHead}>
            <div className={ui.panelTitleRow}>
              <span className={ui.panelIcon} aria-hidden="true">
                <PiGift />
              </span>
              <h2 className={ui.panelTitle}>{editingId ? `Izmena: ${form.title || editingId}` : "Novi paket"}</h2>
            </div>
          </div>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Naziv</span>
            <input
              className={ui.input}
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="npr. Top 5 muških"
              maxLength={80}
            />
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Kratak opis (opciono)</span>
            <textarea
              className={ui.textarea}
              rows={2}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="npr. Pet najtraženijih muških parfema — idealno za prvo upoznavanje."
              maxLength={300}
            />
          </label>

          <div className={styles.row}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Zapremina po parfemu</span>
              <select className={ui.select} value={form.ml} onChange={(e) => setField("ml", Number(e.target.value))}>
                {BUNDLE_ML_OPTIONS.map((ml) => (
                  <option key={ml} value={ml}>
                    {ml} ml
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Popust paketa</span>
              <span className={ui.inputSuffix}>
                <input
                  className={ui.input}
                  inputMode="numeric"
                  value={form.discount}
                  onChange={(e) => setField("discount", e.target.value.replace(/[^\d]/g, ""))}
                />
                <span>%</span>
              </span>
            </label>
          </div>

          <div className={ui.field}>
            <span className={ui.fieldLabel}>Parfemi u paketu ({form.perfumeIds.length}/10)</span>
            {form.perfumeIds.length > 0 && (
              <ol className={styles.chosen}>
                {form.perfumeIds.map((id, index) => {
                  const perfume = byId.get(id);
                  const missing = preview.missing.includes(id);
                  return (
                    <li key={id} className={missing ? styles.chosenMissing : ""}>
                      <span className={styles.chosenIndex}>{index + 1}</span>
                      <span className={styles.chosenName}>
                        {perfume ? (
                          <>
                            <small>{perfume.brand}</small> {perfume.name}
                          </>
                        ) : (
                          id
                        )}
                        {missing && <em> — nema {form.ml} ml na stanju</em>}
                      </span>
                      <button
                        type="button"
                        aria-label="Ukloni iz paketa"
                        onClick={() => setField("perfumeIds", form.perfumeIds.filter((value) => value !== id))}
                      >
                        <PiX />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            {form.perfumeIds.length < 10 && (
              <div className={styles.searchBox}>
                <PiMagnifyingGlass className={styles.searchIcon} aria-hidden="true" />
                <input
                  className={`${ui.input} ${styles.searchInput}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Dodaj parfem — kucaj naziv ili brend…"
                />
                {results.length > 0 && (
                  <ul className={styles.results}>
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setField("perfumeIds", [...form.perfumeIds, p.id]);
                            setSearch("");
                          }}
                        >
                          <span>
                            {p.brand} <strong>{p.name}</strong>
                          </span>
                          <small>{p.variants.map((v) => `${v.ml} ml`).join(" · ")}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className={styles.row}>
            <label className={ui.switchRow}>
              <span className={ui.switchText}>
                Aktivan
                <small>Vidi se na sajtu.</small>
              </span>
              <input
                type="checkbox"
                className={ui.switch}
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Redosled (manji = ranije)</span>
              <input
                className={ui.input}
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(e) => setField("sortOrder", e.target.value.replace(/[^\d-]/g, ""))}
              />
            </label>
          </div>

          {form.perfumeIds.length >= 2 && (
            <div className={styles.preview}>
              <div>
                <span>Pojedinačno</span>
                <s>{formatRsd(preview.regular)}</s>
              </div>
              <div>
                <span>Cena paketa</span>
                <strong>{formatRsd(preview.price)}</strong>
              </div>
              <div>
                <span>Kupac štedi</span>
                <b>{formatRsd(Math.max(0, preview.regular - preview.price))}</b>
              </div>
              {!preview.available && (
                <em>Paket se neće moći kupiti dok svi parfemi nemaju {form.ml} ml na stanju.</em>
              )}
            </div>
          )}

          <div className={styles.formActions}>
            <button type="button" className={ui.btnPrimary} disabled={saving} onClick={() => void save()}>
              {saving ? "Čuvam…" : editingId ? "Sačuvaj izmene" : "Napravi paket"}
            </button>
            {editingId && (
              <button type="button" className={ui.btn} onClick={startNew}>
                Otkaži
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}