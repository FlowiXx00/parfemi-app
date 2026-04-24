import Image from "next/image";
import styles from "./founder-section.module.css";

export default function FounderSection() {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        <div className={styles.media}>
          <div className={styles.card}>
            <Image
              src="/images/founder-section.png"
              alt="Atelier Dekant dekanti i parfemi"
              width={1536}
              height={1024}
              sizes="(max-width: 980px) calc(100vw - 48px), 52vw"
              className={styles.img}
            />
            <div className={styles.mediaBadge}>Pažljivo pripremljeni dekanti</div>
          </div>

          <div className={styles.overlay} aria-hidden="true" />
        </div>

        <div className={styles.textCol}>
          <div className={styles.kickerRow}>
            <div className={styles.kickerLine} />
            <div className={styles.kicker}>Naša priča</div>
          </div>

          <h2 className={styles.h2}>Zašto postoji Atelier Dekant</h2>

          <p className={styles.lead}>
            Parfem ne pokazuje sve na papiriću. Tek na koži, kroz nekoliko sati
            i nekoliko nošenja, postaje jasno da li je zaista vaš.
          </p>

          <div className={styles.quote}>
            {`„Atelier Dekant je nastao iz želje da izbor parfema bude mirniji, sigurniji i ličniji. Umesto brze odluke u parfimeriji, želimo da miris doživite u svom danu, na svojoj koži i u svom ritmu.

Zato pripremamo dekante originalnih parfema uz fokus na urednost, autentičnost i poverenje. Naš cilj nije samo da ponudimo miris, već da vam pomognemo da prepoznate onaj koji se prirodno uklapa u vas.”`}
          </div>

          <div className={styles.metaRow}>
            <div>
              <div className={styles.metaLabel}>Fokus</div>
              <div className={styles.metaValue}>Autentičnost, urednost i poverenje</div>
            </div>
            <div>
              <div className={styles.metaLabel}>Format</div>
              <div className={styles.metaValue}>3ml, 5ml i 10ml dekanti</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
