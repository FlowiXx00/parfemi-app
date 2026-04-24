import Link from "next/link";
import styles from "./hero.module.css";

const highlights = ["Originalni parfemi", "3ml • 5ml • 10ml", "Sigurna online kupovina"];

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.glowOne} />
        <div className={styles.glowTwo} />
        <div className={styles.grid} />
      </div>

      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.eyebrow}>Atelier Dekant</div>

          <h1 className={`${styles.h1} ${styles.reveal} ${styles.d1}`}>
            PREMIUM DEKANTI PARFEMA
            <span className={styles.h1Accent}> za miris koji stvarno nosite</span>
          </h1>

          <p className={`${styles.p} ${styles.reveal} ${styles.d2}`}>
            Istražite dizajnerske i niche parfeme kroz pažljivo pripremljene dekante.
            Nosite miris nekoliko dana, upoznajte ga na svojoj koži i odlučite bez
            pritiska kupovine pune bočice.
          </p>

          <div className={`${styles.cta} ${styles.reveal} ${styles.d3}`}>
            <Link href="/shop" className={`${styles.btn} ${styles.btnPrimary}`}>
              Pogledajte sve parfeme
            </Link>

            <Link href="/about" className={`${styles.btn} ${styles.btnGhost}`}>
              Saznajte više
            </Link>
          </div>

          <div className={`${styles.highlights} ${styles.reveal} ${styles.d4}`}>
            {highlights.map((item) => (
              <span key={item} className={styles.highlightItem}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <aside
          className={`${styles.infoCard} ${styles.reveal} ${styles.d5}`}
          aria-label="Prednosti kupovine dekanta"
        >
          <div className={styles.infoLabel}>Zašto dekant?</div>

          <div className={styles.infoStat}>Probajte pre pune bočice</div>

          <p className={styles.infoText}>
            Manji format vam daje vreme da parfem proverite u realnim uslovima:
            tokom dana, u različitim prilikama i na svojoj koži.
          </p>

          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.infoItemTitle}>Autentičnost</span>
              <span className={styles.infoItemText}>
                Originalan sadržaj iz originalnog pakovanja.
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoItemTitle}>Iskustvo</span>
              <span className={styles.infoItemText}>
                Upoznajte miris kroz vreme, ne samo na prvi utisak.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
