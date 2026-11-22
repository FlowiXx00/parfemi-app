import type { Metadata } from "next";
import ScentQuiz from "@/features/quiz/components/scent-quiz/scent-quiz";
import styles from "./kviz.module.css";

export const metadata: Metadata = {
  title: "Pronađi svoj miris — kviz",
  description: "Odgovori na 6 kratkih pitanja i dobij preporuku parfema po svom ukusu.",
  alternates: { canonical: "/kviz" },
};

export default function KvizPage() {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <span className={styles.kicker}>Kviz · 1 minut</span>
        <h1 className={styles.title}>Pronađi svoj miris</h1>
        <p className={styles.lead}>Šest kratkih pitanja, a na kraju parfemi koji ti najviše odgovaraju.</p>
      </header>
      <ScentQuiz />
    </main>
  );
}
