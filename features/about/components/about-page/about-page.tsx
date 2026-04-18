import Link from "next/link";
import styles from "./about-page.module.css";

const values = [
  {
    title: "Originalni parfemi",
    text: "Svaki dekant pripremamo isključivo iz originalnih parfema, sa fokusom na kvalitet i poverenje.",
  },
  {
    title: "Pažljivo dekantovanje",
    text: "Svaki miris se priprema pažljivo i uredno, kako bi iskustvo bilo čisto, sigurno i dostojno samog parfema.",
  },
  {
    title: "Sigurno pakovanje",
    text: "Pakujemo tako da dekant stigne bezbedno, uredno i spremno da odmah postane deo tvoje kolekcije.",
  },
];

const reasons = [
  "Testiranje parfema na koži pre kupovine cele bočice",
  "Otkrivanje niche i dizajnerskih mirisa bez velikog početnog troška",
  "Praktična opcija za putovanja i svakodnevno nošenje",
  "Mogućnost da isprobaš više različitih mirisa i pronađeš svoj potpis",
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>Atelier Dekant</span>

            <h1 className={styles.title}>
              Mesto za one koji žele da parfem upoznaju pre cele bočice.
            </h1>

            <p className={styles.lead}>
              Atelier Dekant nastao je iz jednostavne ideje — da upoznavanje sa
              parfemom treba da bude lično, pažljivo i bez žurbe. Verujemo da se
              pravi utisak o mirisu ne stvara na papiriću ili u prvih nekoliko
              minuta, već na koži, kroz vreme, u stvarnom životu.
            </p>

            <div className={styles.heroActions}>
              <Link href="/shop" className={styles.primaryBtn}>
                Pogledaj parfeme
              </Link>

              <Link href="/contact" className={styles.secondaryBtn}>
                Kontakt
              </Link>
            </div>
          </div>

          <div className={styles.heroCard}>
            <div className={styles.heroCardInner}>
              <span className={styles.cardLabel}>Naš pristup</span>
              <p className={styles.cardText}>
                Ne posmatramo dekant kao zamenu za bočicu, već kao način da
                parfem zaista upoznaš — kako se otvara, kako se menja i kako živi
                na tvojoj koži.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.storySection}>
        <div className={styles.sectionIntro}>
          <span className={styles.kicker}>Naša priča</span>
          <h2 className={styles.sectionTitle}>Zašto postoji Atelier Dekant</h2>
        </div>

        <div className={styles.storyGrid}>
          <div className={styles.storyText}>
            <p>
              Kupovina parfema često dolazi prebrzo. Miris se proba usput, pod
              jakim svetlom parfimerije, među desetinama drugih nota, i odluka se
              donese pre nego što parfem zaista pokaže svoj karakter.
            </p>

            <p>
              Zato smo želeli da napravimo prostor u kome je iskustvo drugačije.
              Mesto gde možeš da izdvojiš vreme, nosiš parfem nekoliko dana,
              osetiš razvoj nota i odlučiš bez pritiska da li je to zaista miris
              za tebe.
            </p>
          </div>

          <div className={styles.storyAside}>
            <div className={styles.quoteCard}>
              <p>
                Dobar parfem zaslužuje da bude doživljen polako — ne samo
                kupljen.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.valuesSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.kicker}>Kako radimo</span>
          <h2 className={styles.sectionTitle}>Kvalitet, pažnja i poverenje</h2>
        </div>

        <div className={styles.valuesGrid}>
          {values.map((item) => (
            <article key={item.title} className={styles.valueCard}>
              <div className={styles.valueNumber}>0{values.indexOf(item) + 1}</div>
              <h3 className={styles.valueTitle}>{item.title}</h3>
              <p className={styles.valueText}>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.whySection}>
        <div className={styles.sectionIntro}>
          <span className={styles.kicker}>Zašto dekanti</span>
          <h2 className={styles.sectionTitle}>
            Pametniji način da otkriješ parfeme
          </h2>
        </div>

        <div className={styles.whyPanel}>
          <div className={styles.whyLeft}>
            <p>
              Dekanti nisu samo praktični — oni omogućavaju slobodu da istražuješ
              više, biraš promišljenije i pronađeš mirise koji zaista odgovaraju
              tvom ukusu i ritmu života.
            </p>
          </div>

          <div className={styles.whyRight}>
            <ul className={styles.reasonList}>
              {reasons.map((reason) => (
                <li key={reason} className={styles.reasonItem}>
                  <span className={styles.reasonDot} />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.approachSection}>
        <div className={styles.approachCard}>
          <span className={styles.kicker}>Naš pogled</span>
          <h2 className={styles.sectionTitle}>
            Miris nije samo proizvod, već iskustvo.
          </h2>

          <p className={styles.approachText}>
            Zato nam nije cilj samo da ponudiš sebi još jedan parfem, već da
            pronađeš onaj koji će ti zaista odgovarati. Bilo da tek ulaziš u svet
            parfema ili već gradiš svoju kolekciju, Atelier Dekant je tu da ti
            omogući sigurnije, lepše i promišljenije otkrivanje mirisa.
          </p>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <div>
            <span className={styles.kicker}>Istraži kolekciju</span>
            <h2 className={styles.ctaTitle}>
              Pronađi parfem koji želiš da upoznaš.
            </h2>
          </div>

          <div className={styles.ctaActions}>
            <Link href="/shop" className={styles.primaryBtn}>
              Uđi u shop
            </Link>

            <Link href="/contact" className={styles.secondaryBtnLight}>
              Piši nam
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}