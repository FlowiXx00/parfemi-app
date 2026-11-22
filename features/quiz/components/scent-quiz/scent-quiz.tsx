"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PiArrowRight, PiCheckBold } from "react-icons/pi";
import ShowcaseCard from "@/features/shop/components/showroom/showcase-card";
import { useCatalog } from "@/features/shop/client/catalog.api";
import { EMPTY_ANSWERS, QUIZ_STEPS, recommend, shopLinkFor, type QuizAnswers } from "../../lib/quiz";
import styles from "./scent-quiz.module.css";

type StepKey = (typeof QUIZ_STEPS)[number]["key"];

/** Quiz: one question per screen, recommendations from the catalog at the end. */
export default function ScentQuiz() {
  const router = useRouter();
  const catalog = useCatalog(true);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const done = step >= QUIZ_STEPS.length;

  const results = useMemo(() => (done ? recommend(catalog, answers) : []), [answers, catalog, done]);
  const open = useCallback((id: string) => router.push(`/shop?open=${encodeURIComponent(id)}`), [router]);

  function choose(key: StepKey, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setStep((current) => current + 1);
  }

  function toggleFamily(value: QuizAnswers["families"][number]) {
    setAnswers((prev) => {
      const has = prev.families.includes(value);
      const next = has ? prev.families.filter((item) => item !== value) : [...prev.families, value].slice(-2);
      return { ...prev, families: next };
    });
  }

  function restart() {
    setAnswers(EMPTY_ANSWERS);
    setStep(0);
  }

  const current = QUIZ_STEPS[step];

  return (
    <div className={styles.quiz}>
      <div className={styles.progress} aria-hidden="true">
        {QUIZ_STEPS.map((item, index) => (
          <span
            key={item.key}
            className={`${styles.segment} ${index < step ? styles.segmentDone : ""} ${index === step ? styles.segmentCurrent : ""}`}
          />
        ))}
      </div>

      {!done && current ? (
        <section className={styles.step} key={current.key} aria-labelledby="quiz-q">
          <span className={styles.count}>
            Pitanje {step + 1} od {QUIZ_STEPS.length}
          </span>
          <h2 id="quiz-q" className={styles.question}>
            {current.title}
          </h2>
          {"hint" in current && current.hint && <p className={styles.hint}>{current.hint}</p>}

          {"multi" in current ? (
            <>
              <div className={styles.options}>
                {current.options.map((option) => {
                  const active = answers.families.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      className={`${styles.option} ${active ? styles.optionActive : ""}`}
                      onClick={() => toggleFamily(option.value)}
                    >
                      <span className={styles.optionCheck} aria-hidden="true">
                        {active && <PiCheckBold />}
                      </span>
                      <span className={styles.optionText}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className={styles.next} onClick={() => setStep((s) => s + 1)}>
                {answers.families.length ? "Dalje →" : "Nisam siguran — dalje →"}
              </button>
            </>
          ) : (
            <div className={styles.options}>
              {current.options.map((option, index) => (
                <button
                  key={String(option.value)}
                  type="button"
                  className={styles.option}
                  onClick={() => choose(current.key, option.value)}
                >
                  <span className={styles.optionKey} aria-hidden="true">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className={styles.optionText}>
                    {option.label}
                    {"hint" in option && option.hint && <small>{option.hint}</small>}
                  </span>
                  <PiArrowRight className={styles.optionArrow} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {step > 0 && (
            <button type="button" className={styles.back} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              ← Nazad
            </button>
          )}
        </section>
      ) : (
        <section className={styles.results} aria-labelledby="quiz-results">
          <h2 id="quiz-results" className={styles.question}>
            {results.length ? "Ovo bi ti se moglo dopasti" : catalog.length ? "Nismo našli tačan pogodak" : "Tražimo parfeme…"}
          </h2>
          <p className={styles.hint}>
            {results.length
              ? "Izabrali smo po tvojim odgovorima, uz ocene sa Fragrantice. Klikni parfem za detalje."
              : catalog.length
                ? "Probaj blaže uslove (npr. budžet „Nije bitno”) ili pogledaj shop."
                : ""}
          </p>

          {results.length > 0 && (
            <div className={styles.grid}>
              {results.map((product) => (
                <ShowcaseCard key={product.id} product={product} onOpen={open} />
              ))}
            </div>
          )}

          <div className={styles.resultActions}>
            <Link href={shopLinkFor(answers)} className={styles.next}>
              Vidi sve takve u shopu →
            </Link>
            <button type="button" className={styles.back} onClick={restart}>
              Počni ponovo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
