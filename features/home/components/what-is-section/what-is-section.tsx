import Link from "next/link";
import Image from "next/image";
import styles from "./what-is-section.module.css";

const items = [
  "Originalan sadržaj iz originalnog pakovanja",
  "Staklene bočice od 3ml, 5ml i 10ml",
  "Manje rizika pri izboru sledećeg parfema",
];

export default function WhatIsSection() {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        <div className={styles.textCol}>
          <div className={styles.kicker}>Šta je Atelier Dekant?</div>

          <h2 className={styles.h2}>Originalni parfemi u formatu za stvarno testiranje</h2>

          <p className={styles.p}>
            Atelier Dekant donosi pažljivo pripremljene dekante dizajnerskih i
            niche parfema za sve koji žele da miris upoznaju pre kupovine cele
            bočice. Svaki dekant se priprema uredno, u kvalitetnoj staklenoj
            ambalaži, sa jasnim fokusom na autentičnost sadržaja.
          </p>

          <p className={styles.p}>
            Poslujemo nezavisno od proizvođača i vlasnika parfemskih brendova.
            Naš cilj je jednostavnije i pristupačnije istraživanje mirisa, bez
            nagađanja i nepotrebnog troška.
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
            <Image
              src="/images/what-is-section.png"
              alt="Tom Ford parfemi i dekanti"
              width={1350}
              height={900}
              sizes="(max-width: 980px) calc(100vw - 48px), 560px"
              className={styles.image}
            />
          </div>
          <div className={styles.floatingNote}>Uredno, diskretno i spremno za svakodnevno testiranje.</div>
        </div>
      </div>
    </section>
  );
}
