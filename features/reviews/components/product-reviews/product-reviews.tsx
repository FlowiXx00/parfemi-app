"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FiCheckCircle } from "react-icons/fi";
import { useSessionUser } from "@/features/auth/client/use-session-user";
import { deleteMyReview, fetchMyReview } from "@/features/reviews/client/reviews.api";
import ReviewForm from "@/features/reviews/components/review-form/review-form";
import Stars from "@/features/reviews/components/stars/stars";
import {
  formatRating,
  formatReviewDate,
  isEditedReview,
  reviewCountLabel,
  sortReviews,
  starsLabel,
  summarizeReviews,
  type MyReviewState,
  type ProductReviews as ProductReviewsData,
  type PublicReview,
  type ReviewSort,
} from "@/features/reviews/lib/reviews";
import styles from "./product-reviews.module.css";

const PAGE_SIZE = 6;
const SECTION_ID = "recenzije";

/** "idle" = not loaded yet (the request starts once the section is in view and the visitor is signed in). */
type MineState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & MyReviewState);

function ReviewCard({
  review,
  own,
  canEdit,
  busy,
  onEdit,
  onDelete,
}: {
  review: PublicReview;
  own: boolean;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={`${styles.card} ${own ? styles.cardOwn : ""}`}>
      <div className={styles.cardHead}>
        <span className={styles.avatar} aria-hidden="true">
          {Array.from(review.name)[0]?.toLocaleUpperCase("sr") ?? "K"}
        </span>
        <div className={styles.who}>
          <span className={styles.name}>
            {review.name}
            {own && <span className={styles.ownBadge}>Tvoja recenzija</span>}
          </span>
          <span className={styles.verified}>
            <FiCheckCircle aria-hidden="true" />
            Verifikovan kupac{review.ml ? ` · ${review.ml} ml` : ""}
          </span>
        </div>
        <time className={styles.date} dateTime={review.createdAt}>
          {formatReviewDate(review.createdAt)}
        </time>
      </div>

      <div className={styles.cardRating}>
        <Stars value={review.rating} />
        <span className={styles.srOnly}>Ocena: {starsLabel(review.rating)} od 5</span>
        {isEditedReview(review) && <span className={styles.edited}>izmenjeno</span>}
      </div>

      <p className={styles.comment}>{review.comment}</p>

      {own && (
        <div className={styles.cardActions}>
          {canEdit && (
            <button type="button" className={styles.linkButton} onClick={onEdit} disabled={busy}>
              Izmeni
            </button>
          )}
          <button type="button" className={`${styles.linkButton} ${styles.linkDanger}`} onClick={onDelete} disabled={busy}>
            {busy ? "Brišemo…" : "Obriši"}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Reviews of this shop's customers below the product page: average, count per star, the list and the
 * form for verified buyers. The list comes from the server (static HTML); whether the visitor may
 * write a review is asked only once the section scrolls into view.
 */
export default function ProductReviews({
  productId,
  productName,
  initial,
}: {
  productId: string;
  productName: string;
  initial: ProductReviewsData;
}) {
  const { user, ready: sessionReady } = useSessionUser();
  const userId = user?.id ?? null;
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const [mine, setMine] = useState<MineState>({ status: "idle" });
  const [mineFor, setMineFor] = useState<string | null>(null);
  // IDs of the visitor's own review(s) in the server list: shown from `mine` instead (fresh), or hidden
  // once deleted.
  const [ownIds, setOwnIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Signed out or switched accounts: what was loaded belongs to someone else (reset during render,
  // not in an effect).
  if (mineFor !== userId) {
    setMineFor(userId);
    setMine({ status: "idle" });
    setOwnIds([]);
    setFormOpen(false);
    setNotice(null);
  }

  // Lazy: the form state is needed only when the visitor gets to the reviews (also after a jump to
  // #recenzije, since the observer reports the section as visible right away).
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !sessionReady || !userId || mine.status !== "idle") return;
    let cancelled = false;

    fetchMyReview(productId)
      .then((state) => {
        if (cancelled) return;
        setMine({ status: "ready", ...state });
        const ownId = state.review?.id;
        if (ownId) setOwnIds((ids) => (ids.includes(ownId) ? ids : [...ids, ownId]));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMine({ status: "error", message: (error as Error).message || "Nismo uspeli da proverimo tvoje porudžbine." });
      });

    return () => {
      cancelled = true;
    };
  }, [inView, sessionReady, userId, mine.status, productId]);

  const ownReview = mine.status === "ready" ? mine.review : null;
  const canWrite = mine.status === "ready" && mine.receivedMl.length > 0;

  const reviews = useMemo(() => {
    if (mine.status !== "ready") return initial.reviews;
    const hidden = new Set(ownIds);
    const others = initial.reviews.filter((review) => !hidden.has(review.id));
    return mine.review ? [mine.review, ...others] : others;
  }, [initial.reviews, mine, ownIds]);

  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);

  const listed = useMemo(() => {
    const filtered = filter ? reviews.filter((review) => review.rating === filter) : reviews;
    const sorted = sortReviews(filtered, sort);
    // The visitor's own review always comes first.
    const ownIndex = ownReview ? sorted.findIndex((review) => review.id === ownReview.id) : -1;
    if (ownIndex > 0) sorted.unshift(...sorted.splice(ownIndex, 1));
    return sorted;
  }, [reviews, filter, sort, ownReview]);

  const shown = listed.slice(0, visibleCount);
  const remaining = listed.length - shown.length;

  function onSaved(review: PublicReview) {
    const wasEdit = Boolean(ownReview);
    setMine((current) => (current.status === "ready" ? { ...current, review } : current));
    setOwnIds((ids) => (ids.includes(review.id) ? ids : [...ids, review.id]));
    setFormOpen(false);
    setFilter(null);
    setNotice({ tone: "ok", text: wasEdit ? "Izmene su sačuvane." : "Hvala! Tvoja recenzija je objavljena." });
  }

  async function onDelete() {
    if (!ownReview || deleting) return;
    if (!window.confirm("Obrisati tvoju recenziju? Ovo ne može da se poništi.")) return;

    setDeleting(true);
    setNotice(null);
    try {
      await deleteMyReview(productId);
      setMine((current) => (current.status === "ready" ? { ...current, review: null } : current));
      setFormOpen(false);
      setNotice({ tone: "ok", text: "Recenzija je obrisana." });
    } catch (error) {
      setNotice({ tone: "error", text: (error as Error).message || "Brisanje nije uspelo." });
    } finally {
      setDeleting(false);
    }
  }

  function toggleFilter(star: number) {
    setFilter((current) => (current === star ? null : star));
    setVisibleCount(PAGE_SIZE);
  }

  const loginHref = `/login?next=${encodeURIComponent(`/shop/${productId}#${SECTION_ID}`)}`;

  /** What the visitor can do: sign in, write, edit, or why they can't (yet). */
  function renderCta() {
    if (!sessionReady) return null;

    if (!userId) {
      return (
        <>
          <p className={styles.ctaText}>Kupio/la si ovaj parfem? Prijavi se i podeli utisak sa drugima.</p>
          <Link href={loginHref} className={styles.ctaButton}>
            Prijavi se i oceni
          </Link>
        </>
      );
    }

    if (mine.status === "idle") {
      return <p className={styles.ctaMuted}>Proveravamo tvoje porudžbine…</p>;
    }

    if (mine.status === "error") {
      return (
        <>
          <p className={styles.ctaMuted}>{mine.message}</p>
          <button type="button" className={styles.ctaGhost} onClick={() => setMine({ status: "idle" })}>
            Pokušaj ponovo
          </button>
        </>
      );
    }

    if (mine.review) {
      return (
        <>
          <p className={styles.ctaText}>Tvoja recenzija je objavljena i vidi se prva u listi.</p>
          {canWrite && !formOpen && (
            <button type="button" className={styles.ctaGhost} onClick={() => setFormOpen(true)}>
              Izmeni recenziju
            </button>
          )}
        </>
      );
    }

    if (canWrite) {
      return (
        <>
          <p className={styles.ctaText}>Probao/la si ovaj miris. Kako ti se čini?</p>
          {!formOpen && (
            <button type="button" className={styles.ctaButton} onClick={() => setFormOpen(true)}>
              Napiši recenziju
            </button>
          )}
        </>
      );
    }

    if (mine.pendingReceipt) {
      return (
        <>
          <p className={styles.ctaText}>
            Tvoja porudžbina sa ovim parfemom je na putu. Kad stigne, potvrdi preuzimanje i ostavi recenziju.
          </p>
          <Link href="/orders" className={styles.ctaGhost}>
            Moje porudžbine
          </Link>
        </>
      );
    }

    return (
      <p className={styles.ctaMuted}>
        Recenziju mogu da ostave kupci kojima je stigla porudžbina sa ovim parfemom (porudžbina iz naloga).
      </p>
    );
  }

  return (
    <section id={SECTION_ID} ref={sectionRef} className={styles.section} aria-labelledby="reviews-title">
      <span className={styles.kicker}>Recenzije kupaca</span>
      <h2 id="reviews-title" className={styles.title}>
        Šta kažu kupci o mirisu {productName}
      </h2>
      <p className={styles.sub}>Ocenjuju samo kupci kojima je porudžbina sa ovim parfemom stigla.</p>

      <div className={styles.layout}>
        <aside className={styles.summaryCard} aria-label="Pregled ocena">
          {summary.count > 0 ? (
            <>
              <div className={styles.scoreRow}>
                <span className={styles.score}>{formatRating(summary.average)}</span>
                <div className={styles.scoreText}>
                  <Stars value={summary.average} size="md" />
                  <span className={styles.muted}>{reviewCountLabel(summary.count)}</span>
                </div>
                <span className={styles.srOnly}>
                  Prosečna ocena {formatRating(summary.average)} od 5, {reviewCountLabel(summary.count)}
                </span>
              </div>

              <ul className={styles.bars}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = summary.distribution[star - 1] ?? 0;
                  const percent = summary.count ? Math.round((count / summary.count) * 100) : 0;
                  return (
                    <li key={star}>
                      <button
                        type="button"
                        className={`${styles.barButton} ${filter === star ? styles.barButtonActive : ""}`}
                        onClick={() => toggleFilter(star)}
                        disabled={!count && filter !== star}
                        aria-pressed={filter === star}
                        aria-label={`${starsLabel(star)}: ${reviewCountLabel(count)}${filter === star ? " (prikazane)" : ""}`}
                      >
                        <span className={styles.barLabel} aria-hidden="true">
                          {star} ★
                        </span>
                        <span className={styles.barTrack} aria-hidden="true">
                          <span className={styles.barFill} style={{ width: `${percent}%` }} />
                        </span>
                        <span className={styles.barCount} aria-hidden="true">
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className={styles.emptySummary}>
              <strong>Još nema recenzija.</strong> Kupci kojima stigne ovaj parfem mogu prvi da ga ocene.
            </p>
          )}

          <div className={styles.cta}>
            {renderCta()}
            {notice && (
              <p
                className={`${styles.notice} ${notice.tone === "error" ? styles.noticeError : ""}`}
                role={notice.tone === "error" ? "alert" : "status"}
              >
                {notice.text}
              </p>
            )}
          </div>
        </aside>

        <div className={styles.listColumn}>
          {formOpen && mine.status === "ready" && (
            <ReviewForm
              productId={productId}
              productName={productName}
              receivedMl={mine.receivedMl}
              displayName={mine.displayName}
              existing={mine.review}
              onSaved={onSaved}
              onCancel={() => setFormOpen(false)}
            />
          )}

          {summary.count > 1 && (
            <div className={styles.toolbar}>
              {filter ? (
                <button type="button" className={styles.filterChip} onClick={() => toggleFilter(filter)}>
                  Samo {starsLabel(filter)} <span aria-hidden="true">✕</span>
                  <span className={styles.srOnly}>, prikaži sve</span>
                </button>
              ) : (
                <span className={styles.muted}>{reviewCountLabel(summary.count)}</span>
              )}
              <label className={styles.sortLabel}>
                <span>Redosled</span>
                <select
                  className={styles.sortSelect}
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as ReviewSort);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <option value="newest">Najnovije</option>
                  <option value="highest">Najbolje ocenjene</option>
                  <option value="lowest">Najlošije ocenjene</option>
                </select>
              </label>
            </div>
          )}

          {shown.length > 0 ? (
            <ul className={styles.list}>
              {shown.map((review) => {
                const own = review.id === ownReview?.id;
                return (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    own={own}
                    canEdit={own && canWrite && !formOpen}
                    busy={own && deleting}
                    onEdit={() => setFormOpen(true)}
                    onDelete={() => void onDelete()}
                  />
                );
              })}
            </ul>
          ) : (
            !formOpen && (
              <div className={styles.emptyList}>
                <span className={styles.emptyStars} aria-hidden="true">
                  ★★★★★
                </span>
                <p>Budi prvi koji će oceniti {productName}.</p>
              </div>
            )
          )}

          {remaining > 0 && (
            <button type="button" className={styles.moreButton} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              Prikaži još ({remaining})
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
