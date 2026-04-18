"use client";

import Link from "next/link";
import styles from "./what-is-section.module.css";

const items = [
  "100% originalan sadržaj iz originalnog pakovanja",
  "Kvalitetne staklene bočice od 3ml, 5ml i 10ml",
  "Jednostavnije upoznavanje mirisa pre pune bočice",
];

export default function WhatIsSection() {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        <div className={styles.textCol}>
          <div className={styles.kicker}>Šta je Atelier Dekant?</div>

          <h2 className={styles.h2}>Originalni parfemi u formatu koji vam daje sigurnost</h2>

          <p className={styles.p}>
            Atelier Dekant predstavlja pažljivo pripremljene dekante originalnih
            dizajnerskih i niche parfema, namenjene svima koji žele da parfem
            upoznaju pre kupovine cele bočice. Dekantovanje se vrši u
            kontrolisanim uslovima, u kvalitetne staklene bočice, uz poseban
            fokus na urednost, sigurnost i autentičnost sadržaja.
          </p>

          <p className={styles.p}>
            Poslujemo nezavisno od proizvođača i vlasnika parfemskih brendova,
            sa ciljem da omogućimo jednostavnije, sigurnije i pristupačnije
            otkrivanje mirisa — bez nagađanja i bez nepotrebnog troška.
          </p>

          <div className={styles.points}>
            {items.map((item) => (
              <div key={item} className={styles.pointItem}>
                <span className={styles.pointIcon}>•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className={styles.cta}>
            <Link href="/shop" className={styles.btn}>
              Pogledajte sve parfeme
            </Link>
          </div>
        </div>

        <div className={styles.imageCol}>
          <div className={styles.card}>
            <img
              src="/images/what-is-section.png"
              alt="Tom Ford parfemi i dekanti"
              className={styles.image}
              loading="lazy"
            />
          </div>
          <div className={styles.floatingNote}>Diskretno, uredno i autentično iskustvo kupovine.</div>
        </div>
      </div>
    </section>
  );
}
