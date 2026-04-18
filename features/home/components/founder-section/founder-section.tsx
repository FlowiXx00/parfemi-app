"use client";

import styles from "./founder-section.module.css";

export default function FounderSection() {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        <div className={styles.media}>
          <div className={styles.card}>
            <img
              src="/images/founder-section.png"
              alt="Atelier Dekant dekanti i parfemi"
              className={styles.img}
              loading="lazy"
            />
            <div className={styles.mediaBadge}>Pažljivo birani mirisi</div>
          </div>

          <div className={styles.overlay} aria-hidden="true" />
        </div>

        <div className={styles.textCol}>
          <div className={styles.kickerRow}>
            <div className={styles.kickerLine} />
            <div className={styles.kicker}>Naša priča</div>
          </div>

          <h2 className={styles.h2}>Kako je nastao Atelier Dekant</h2>

          <p className={styles.lead}>
            Želeli smo da izbor parfema učinimo jednostavnijim, sigurnijim i
            pristupačnijim — bez pritiska da kupite celu bočicu pre nego što
            zaista upoznate miris.
          </p>

          <div className={styles.quote}>
            {`„Atelier Dekant je nastao iz želje da izbor parfema učinimo jednostavnijim, sigurnijim i pristupačnijim. Verujemo da parfem treba prvo doživeti na svojoj koži, u svom ritmu i kroz vreme, pre odluke o celoj bočici.

Zato pažljivo pripremamo dekante originalnih parfema, sa fokusom na autentičnost, transparentnost i iskustvo koje uliva poverenje. Naš cilj nije samo da ponudimo miris, već da vam pomognemo da pronađete onaj pravi.”`}
          </div>

          <div className={styles.metaRow}>
            <div>
              <div className={styles.metaLabel}>Fokus</div>
              <div className={styles.metaValue}>Autentičnost i poverenje</div>
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
