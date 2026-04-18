"use client";

import Link from "next/link";
import { memo, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./product-reviews.module.css";
import {
  addOrUpdateReview,
  deleteMyReview,
  getMyProductReview,
  getProductReviews,
  type ProductReviewRow,
} from "@/features/shop/client/reviews.api";

type ProductReviewsProps = {
  productId: string;
  productName: string;
  isLoggedIn: boolean;
};

type Review = {
  id: string;
  userId: string;
  fullName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("sr-RS");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function mapReviewRow(row: ProductReviewRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const Stars = memo(function Stars({
  value,
  activeValue,
  onSelect,
  interactive = false,
}: {
  value: number;
  activeValue?: number;
  onSelect?: (rating: number) => void;
  interactive?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = interactive
    ? hovered || activeValue || value
    : activeValue ?? value;

  return (
    <div
      className={interactive ? styles.starsInput : styles.starsDisplay}
      aria-label={`Ocena ${shown} od 5`}
      onMouseLeave={() => {
        if (interactive) setHovered(0);
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= shown;

        if (interactive && onSelect) {
          return (
            <button
              key={star}
              type="button"
              className={`${styles.starButton} ${
                filled ? styles.starButtonActive : ""
              }`}
              onMouseEnter={() => setHovered(star)}
              onFocus={() => setHovered(star)}
              onBlur={() => setHovered(0)}
              onClick={() => onSelect(star)}
              aria-label={`Oceni sa ${star}`}
              title={`${star}/5`}
            >
              ★
            </button>
          );
        }

        return (
          <span
            key={star}
            className={`${styles.starStatic} ${
              filled ? styles.starStaticActive : ""
            }`}
          >
            ★
          </span>
        );
      })}
    </div>
  );
});

export default function ProductReviews({
  productId,
  productName,
  isLoggedIn,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [submitError, setSubmitError] = useState("");

  const hasExistingReview = Boolean(myReview);

  const fillFormFromReview = useCallback((review: Review | null) => {
    if (!review) {
      setRating(0);
      setComment("");
      return;
    }

    setRating(review.rating);
    setComment(review.comment);
  }, []);

  const fetchData = useCallback(async () => {
    const rows = await getProductReviews(productId);

    let mine: ProductReviewRow | null = null;

    if (isLoggedIn) {
      try {
        mine = await getMyProductReview(productId);
      } catch {
        mine = null;
      }
    }

    return {
      reviews: rows.map(mapReviewRow),
      myReview: mine ? mapReviewRow(mine) : null,
    };
  }, [productId, isLoggedIn]);

  const reloadData = useCallback(async () => {
    const data = await fetchData();
    setReviews(data.reviews);
    setMyReview(data.myReview);
    return data;
  }, [fetchData]);

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      try {
        setLoadingReviews(true);
        const data = await fetchData();

        if (!active) return;

        setReviews(data.reviews);
        setMyReview(data.myReview);
      } catch (error) {
        console.error("Greška pri učitavanju recenzija:", error);

        if (!active) return;

        setReviews([]);
        setMyReview(null);
      } finally {
        if (active) {
          setLoadingReviews(false);
        }
      }
    }

    void loadReviews();

    return () => {
      active = false;
    };
  }, [fetchData]);

  useEffect(() => {
    if (!formOpen) return;
    fillFormFromReview(myReview);
  }, [formOpen, myReview, fillFormFromReview]);

  const stats = useMemo(() => {
    if (!reviews.length) {
      return {
        average: 0,
        count: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const summary = reviews.reduce(
      (accumulator, review) => {
        accumulator.total += review.rating;
        accumulator.breakdown[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
        return accumulator;
      },
      {
        total: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      }
    );

    return {
      average: summary.total / reviews.length,
      count: reviews.length,
      breakdown: summary.breakdown,
    };
  }, [reviews]);

  const visibleReviews = useMemo(() => {
    if (selectedFilter === null) return reviews;
    return reviews.filter((review) => review.rating === selectedFilter);
  }, [reviews, selectedFilter]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isLoggedIn) return;
    if (!rating) return;
    if (!comment.trim()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      await addOrUpdateReview({
        productId,
        rating,
        comment,
      });

      await reloadData();

      setSelectedFilter(null);
      setFormOpen(false);
    } catch (error: unknown) {
      console.error("Greška pri upisu recenzije:", error);

      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Došlo je do greške pri slanju recenzije.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!myReview) return;

    const confirmed = window.confirm(
      "Da li si siguran da želiš da obrišeš svoju recenziju?"
    );

    if (!confirmed) return;

    setDeleting(true);
    setSubmitError("");

    try {
      await deleteMyReview(productId);

      await reloadData();

      fillFormFromReview(null);
      setSelectedFilter(null);
      setFormOpen(false);
    } catch (error: unknown) {
      console.error("Greška pri brisanju recenzije:", error);

      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Došlo je do greške pri brisanju recenzije.");
      }
    } finally {
      setDeleting(false);
    }
  }

  function handleToggleForm() {
    setSubmitError("");
    setFormOpen((prev) => !prev);
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Recenzije</span>
          <h2 className={styles.title}>Ocene i utisci</h2>
          <p className={styles.subtitle}>
            Pogledaj šta drugi misle o parfemu <b>{productName}</b> i ostavi svoj
            utisak.
          </p>
        </div>

        <div className={styles.headerActions}>
          {isLoggedIn ? (
            <button
              type="button"
              className={`${styles.writeReviewButton} ${
                formOpen ? styles.writeReviewButtonActive : ""
              }`}
              onClick={handleToggleForm}
            >
              <span className={styles.writeReviewButtonIcon}>
                {formOpen ? "×" : "+"}
              </span>
              <span>
                {formOpen
                  ? "Zatvori formu"
                  : hasExistingReview
                  ? "Uredi svoju recenziju"
                  : "Napiši recenziju"}
              </span>
            </button>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/shop/${productId}`)}`}
              className={styles.writeReviewButton}
            >
              <span className={styles.writeReviewButtonIcon}>+</span>
              <span>Prijavi se za recenziju</span>
            </Link>
          )}
        </div>
      </div>

      <div
        className={`${styles.topGrid} ${
          formOpen && isLoggedIn
            ? styles.topGridWithForm
            : styles.topGridCompact
        }`}
      >
        <div className={styles.summaryCard}>
          <div className={styles.summaryMain}>
            <div className={styles.averageNumber}>
              {stats.count ? stats.average.toFixed(1) : "—"}
            </div>

            <div className={styles.summarySide}>
              <Stars value={Math.round(stats.average)} />
              <div className={styles.summaryCount}>
                {stats.count === 0
                  ? "Još nema ocena"
                  : `${stats.count} ${stats.count === 1 ? "ocena" : "ocene"}`}
              </div>
            </div>
          </div>

          <div className={styles.breakdown}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.breakdown[star as 1 | 2 | 3 | 4 | 5];
              const percent =
                stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
              const isActive = selectedFilter === star;

              return (
                <button
                  key={star}
                  type="button"
                  className={`${styles.barRowButton} ${
                    isActive ? styles.barRowButtonActive : ""
                  }`}
                  onClick={() =>
                    setSelectedFilter((prev) => (prev === star ? null : star))
                  }
                  aria-pressed={isActive}
                  title={
                    isActive
                      ? `Prikazani su komentari sa ${star} zvezdica`
                      : `Prikaži komentare sa ${star} zvezdica`
                  }
                >
                  <span className={styles.barLabel}>{star}★</span>

                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <span className={styles.barValue}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isLoggedIn && formOpen && (
          <form className={styles.formCard} onSubmit={handleSubmit}>
            <h3 className={styles.formTitle}>
              {hasExistingReview ? "Uredi svoju recenziju" : "Ostavi komentar"}
            </h3>

            {hasExistingReview ? (
              <p className={styles.subtitle}>
                Već si ostavio recenziju za ovaj parfem. Možeš da je izmeniš ili
                obrišeš.
              </p>
            ) : null}

            {submitError ? (
              <div className={styles.formError}>{submitError}</div>
            ) : null}

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Ocena</span>
              <Stars
                value={rating}
                activeValue={rating}
                onSelect={setRating}
                interactive
              />
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Komentar</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className={styles.textarea}
                placeholder="Napiši svoj utisak o parfemu..."
                rows={5}
                maxLength={500}
              />
              <span className={styles.counter}>{comment.length}/500</span>
            </label>

            <div
              style={{ display: "flex", gap: "12px", alignItems: "center" }}
            >
              <button
                type="submit"
                className={styles.submitButton}
                disabled={!rating || !comment.trim() || submitting || deleting}
              >
                {submitting
                  ? "Čuvanje..."
                  : hasExistingReview
                  ? "Sačuvaj izmene"
                  : "Pošalji utisak"}
              </button>

              {hasExistingReview ? (
                <button
                  type="button"
                  className={styles.clearFilterButton}
                  onClick={handleDelete}
                  disabled={submitting || deleting}
                >
                  {deleting ? "Brisanje..." : "Obriši recenziju"}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>

      <div className={styles.listHeader}>
        <div className={styles.listTitle}>
          {selectedFilter === null
            ? "Svi komentari"
            : `Komentari sa ocenom ${selectedFilter}★`}
        </div>

        {selectedFilter !== null && (
          <button
            type="button"
            className={styles.clearFilterButton}
            onClick={() => setSelectedFilter(null)}
          >
            Prikaži sve
          </button>
        )}
      </div>

      <div className={styles.list}>
        {loadingReviews ? (
          <div className={styles.emptyState}>Učitavanje recenzija...</div>
        ) : visibleReviews.length > 0 ? (
          visibleReviews.map((review) => {
            const isOwnReview = myReview?.userId === review.userId;
            const authorLabel = isOwnReview
              ? "Ti"
              : review.fullName || "Korisnik";

            return (
              <article key={review.id} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <div className={styles.authorWrap}>
                    <div className={styles.avatar}>
                      {getInitials(authorLabel)}
                    </div>

                    <div>
                      <div className={styles.author}>{authorLabel}</div>
                      <div className={styles.meta}>
                        Datum komentara - {formatDate(review.createdAt)}
                      </div>
                    </div>
                  </div>

                  <Stars value={review.rating} />
                </div>

                <p className={styles.reviewText}>{review.comment}</p>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            Još nema recenzija za ovaj parfem.
          </div>
        )}
      </div>
    </section>
  );
}