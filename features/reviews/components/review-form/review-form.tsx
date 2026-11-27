"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { saveMyReview } from "@/features/reviews/client/reviews.api";
import {
  REVIEW_COMMENT_MAX,
  REVIEW_COMMENT_MIN,
  starsLabel,
  type PublicReview,
} from "@/features/reviews/lib/reviews";
import styles from "./review-form.module.css";

const RATING_WORDS: Record<number, string> = {
  1: "Nije za mene",
  2: "Slabo",
  3: "Solidno",
  4: "Odlično",
  5: "Obožavam",
};

type Props = {
  productId: string;
  productName: string;
  receivedMl: number[];
  displayName: string;
  existing: PublicReview | null;
  onSaved: (review: PublicReview) => void;
  onCancel: () => void;
};

/** Writing or changing the customer's review: stars, volume they tried and a comment. */
export default function ReviewForm({ productId, productName, receivedMl, displayName, existing, onSaved, onCancel }: Props) {
  const id = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [ml, setMl] = useState<number | null>(
    existing?.ml ?? (receivedMl.length === 1 ? (receivedMl[0] ?? null) : null)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The form opens on a click: bring it into view and move focus to the stars (the chosen one, if any).
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const star =
      form.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
      form.querySelector<HTMLInputElement>('input[type="radio"]');
    star?.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const length = comment.trim().length;
  const shown = hover || rating;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (rating < 1) {
      setError("Izaberi ocenu od 1 do 5 zvezdica.");
      return;
    }
    if (length < REVIEW_COMMENT_MIN) {
      setError(`Napiši bar ${REVIEW_COMMENT_MIN} karaktera o mirisu.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      onSaved(await saveMyReview({ productId, rating, comment, ml }));
    } catch (saveError) {
      setError((saveError as Error).message || "Recenzija nije sačuvana. Pokušaj ponovo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={styles.title}>
        {existing ? "Izmeni svoju recenziju" : `Tvoj utisak o mirisu ${productName}`}
      </h3>

      <fieldset className={styles.ratingField}>
        <legend className={styles.label}>Ocena</legend>
        <div className={styles.starPicker} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={`${styles.starOption} ${value <= shown ? styles.starOptionActive : ""}`}
              onMouseEnter={() => setHover(value)}
            >
              <input
                type="radio"
                name={`${id}-rating`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className={styles.radio}
              />
              <span className={styles.starGlyph} aria-hidden="true">
                ★
              </span>
              <span className={styles.srOnly}>{starsLabel(value)}</span>
            </label>
          ))}
          <span className={styles.ratingWord} aria-hidden="true">
            {RATING_WORDS[shown] ?? "Izaberi ocenu"}
          </span>
        </div>
      </fieldset>

      {receivedMl.length > 1 ? (
        <label className={styles.field}>
          <span className={styles.label}>Koju zapreminu si probao/la?</span>
          <select
            className={styles.select}
            value={ml ?? ""}
            onChange={(event) => setMl(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Ne želim da navedem</option>
            {receivedMl.map((volume) => (
              <option key={volume} value={volume}>
                {volume} ml
              </option>
            ))}
          </select>
        </label>
      ) : (
        ml !== null && <p className={styles.mlNote}>Kupljeno: {ml} ml</p>
      )}

      <label className={styles.field}>
        <span className={styles.label}>Utisak o mirisu</span>
        <textarea
          className={styles.textarea}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={REVIEW_COMMENT_MAX}
          rows={5}
          placeholder="Kako se miris razvija na koži, koliko traje, za koje prilike ga nosiš…"
          aria-describedby={`${id}-counter`}
        />
        <span id={`${id}-counter`} className={styles.counter}>
          {length < REVIEW_COMMENT_MIN
            ? `Još bar ${REVIEW_COMMENT_MIN - length} ${REVIEW_COMMENT_MIN - length === 1 ? "karakter" : "karaktera"}`
            : `${length}/${REVIEW_COMMENT_MAX}`}
        </span>
      </label>

      <p className={styles.publishNote}>
        Objavljuje se kao <strong>{displayName}</strong>, uz oznaku „Verifikovan kupac”. Recenziju možeš da izmeniš ili
        obrišeš kad god želiš. Uvredljive recenzije i one koje nisu o proizvodu uklanjamo.
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={saving}>
          {saving ? "Čuvamo…" : existing ? "Sačuvaj izmene" : "Objavi recenziju"}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel} disabled={saving}>
          Otkaži
        </button>
      </div>
    </form>
  );
}
