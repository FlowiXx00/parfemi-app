"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PiArrowClockwise, PiChatCircleText, PiTrash } from "react-icons/pi";
import AdminPageHeader from "@/features/admin/ui/admin-page-header";
import ui from "@/features/admin/ui/admin-ui.module.css";
import Stars from "@/features/reviews/components/stars/stars";
import {
  formatRating,
  formatReviewDate,
  isEditedReview,
  starsLabel,
  summarizeReviews,
} from "@/features/reviews/lib/reviews";
import { normalizeText } from "@/lib/format";
import { AdminReviewsApiError, fetchAdminReviews, removeAdminReview } from "../../client/reviews.api";
import type { AdminReview } from "../../types";
import styles from "./reviews-admin.module.css";

type RatingFilter = "all" | "low" | "1" | "2" | "3" | "4" | "5";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Same as listReviewsAdmin's default limit. */
const ADMIN_LIST_LIMIT = 300;

/** Moderation of customer reviews: overview, search and removing inappropriate ones. */
export default function ReviewsAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState<RatingFilter>("all");
  // Time of the last load, for "last 30 days" (not Date.now() during render).
  const [loadedAt, setLoadedAt] = useState(0);

  const handleError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof AdminReviewsApiError && error.status === 401) return router.replace("/login?next=/admin/recenzije");
      if (error instanceof AdminReviewsApiError && error.status === 403) return router.replace("/");
      setNotice({ tone: "error", text: (error as Error).message || fallback });
    },
    [router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminReviews());
      setLoadedAt(Date.now());
    } catch (error) {
      handleError(error, "Recenzije nisu učitane.");
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  // Initial load (state is set only once the response arrives).
  useEffect(() => {
    fetchAdminReviews()
      .then((reviews) => {
        setRows(reviews);
        setLoadedAt(Date.now());
      })
      .catch((error: unknown) => handleError(error, "Recenzije nisu učitane."))
      .finally(() => setLoading(false));
  }, [handleError]);

  const stats = useMemo(() => {
    const summary = summarizeReviews(rows);
    const recent = loadedAt ? rows.filter((row) => loadedAt - Date.parse(row.createdAt) <= 30 * DAY_MS).length : 0;
    const low = (summary.distribution[0] ?? 0) + (summary.distribution[1] ?? 0);
    return { ...summary, recent, low };
  }, [rows, loadedAt]);

  const filtered = useMemo(() => {
    const needle = normalizeText(query.trim());
    return rows.filter((row) => {
      if (rating === "low" && row.rating > 2) return false;
      if (rating !== "all" && rating !== "low" && row.rating !== Number(rating)) return false;
      if (!needle) return true;
      return normalizeText(`${row.perfumeBrand} ${row.perfumeName} ${row.name} ${row.comment}`).includes(needle);
    });
  }, [rows, query, rating]);

  async function onDelete(row: AdminReview) {
    const label = `${row.perfumeBrand} ${row.perfumeName}`.trim();
    if (!window.confirm(`Obrisati recenziju kupca ${row.name} za ${label}? Ovo ne može da se poništi.`)) return;

    setBusyId(row.id);
    setNotice(null);
    try {
      await removeAdminReview(row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));
      setNotice({ tone: "ok", text: `Recenzija kupca ${row.name} je obrisana; stranica parfema je osvežena.` });
    } catch (error) {
      handleError(error, "Brisanje nije uspelo.");
    } finally {
      setBusyId(null);
    }
  }

  const kpis = [
    {
      label: "Ukupno recenzija",
      value: String(stats.count),
      hint: stats.count >= ADMIN_LIST_LIMIT ? `prikazano najnovijih ${ADMIN_LIST_LIMIT}` : "sa svih stranica parfema",
    },
    { label: "Prosečna ocena", value: stats.count ? formatRating(stats.average) : "—", hint: "od 5 zvezdica" },
    { label: "Poslednjih 30 dana", value: String(stats.recent), hint: "novih recenzija" },
    { label: "Niske ocene", value: String(stats.low), hint: "1–2 zvezdice, vredi pročitati" },
  ];

  return (
    <div className={styles.page}>
      <AdminPageHeader
        title="Recenzije kupaca"
        subtitle="Ocene i utisci kupaca kojima je porudžbina stigla, sa stranica parfema. Obriši uvredljive recenzije ili one koje nisu o proizvodu; kupac svoju recenziju može sam da izmeni ili obriše."
        actions={
          <button type="button" className={ui.btn} onClick={() => void load()} disabled={loading}>
            <PiArrowClockwise aria-hidden="true" /> Osveži
          </button>
        }
      />

      <section className={styles.kpis} aria-label="Pregled recenzija">
        {kpis.map((kpi) => (
          <article key={kpi.label} className={`${ui.panel} ${styles.kpi}`}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <strong className={styles.kpiValue}>{kpi.value}</strong>
            <span className={styles.kpiHint}>{kpi.hint}</span>
          </article>
        ))}
      </section>

      {notice && <div className={`${ui.notice} ${notice.tone === "error" ? ui.noticeError : ""}`}>{notice.text}</div>}

      <section className={ui.panel}>
        <div className={styles.toolbar}>
          <label className={`${ui.field} ${styles.search}`}>
            <span className={ui.fieldLabel}>Pretraga</span>
            <input
              className={ui.input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Parfem, kupac ili tekst recenzije"
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Ocena</span>
            <select className={ui.select} value={rating} onChange={(event) => setRating(event.target.value as RatingFilter)}>
              <option value="all">Sve ocene</option>
              <option value="low">1–2 zvezdice (za proveru)</option>
              {[5, 4, 3, 2, 1].map((star) => (
                <option key={star} value={String(star)}>
                  {starsLabel(star)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className={ui.loading}>Učitavanje recenzija…</div>
        ) : filtered.length === 0 ? (
          <div className={ui.empty}>
            {rows.length === 0
              ? "Još nema recenzija. Pojaviće se ovde kad kupci kojima je stigla porudžbina ocene parfeme."
              : "Nijedna recenzija ne odgovara pretrazi."}
          </div>
        ) : (
          <ul className={styles.list}>
            {filtered.map((row) => (
              <li key={row.id} className={`${styles.row} ${row.rating <= 2 ? styles.rowLow : ""}`}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTop}>
                    <span className={styles.rating}>
                      <Stars value={row.rating} />
                      <span className={styles.srOnly}>{starsLabel(row.rating)} od 5</span>
                    </span>
                    {row.perfumeVisible ? (
                      <a className={styles.perfume} href={`/shop/${encodeURIComponent(row.productId)}#recenzije`} target="_blank" rel="noreferrer">
                        {row.perfumeBrand && <span className={styles.brand}>{row.perfumeBrand}</span>} {row.perfumeName}
                      </a>
                    ) : (
                      <span className={styles.perfume} title="Parfem je sakriven ili obrisan">
                        {row.perfumeName} <small className={styles.hidden}>(nije u šopu)</small>
                      </span>
                    )}
                  </div>
                  <p className={styles.comment}>{row.comment}</p>
                  <div className={styles.meta}>
                    <PiChatCircleText aria-hidden="true" />
                    <span>{row.name}</span>
                    {row.ml ? <span>· {row.ml} ml</span> : null}
                    <span>· {formatReviewDate(row.createdAt)}</span>
                    {isEditedReview(row) && <span>· izmenjeno</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className={ui.btnDanger}
                  onClick={() => void onDelete(row)}
                  disabled={busyId === row.id}
                  aria-label={`Obriši recenziju kupca ${row.name}`}
                >
                  <PiTrash aria-hidden="true" /> {busyId === row.id ? "Brišem…" : "Obriši"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
