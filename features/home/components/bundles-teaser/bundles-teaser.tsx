import Link from "next/link";
import BundleCard from "@/features/bundles/components/bundle-card/bundle-card";
import type { BundleView } from "@/features/bundles/lib/views";
import styles from "./bundles-teaser.module.css";

/** Home page: up to 3 discovery bundles + links to all bundles and the quiz. */
export default function BundlesTeaser({ bundles }: { bundles: BundleView[] }) {
  if (!bundles.length) return null;

  return (
    <section className={styles.section} aria-labelledby="bundles-title">
      <div className={styles.wrap}>
        <header className={styles.head}>
          <div>
            <span className={styles.kicker}>Paketi za probu</span>
            <h2 id="bundles-title" className={styles.h2}>
              Više mirisa, manja cena
            </h2>
            <p className={styles.p}>
              Ne znaš odakle da kreneš? Uzmi paket — ili odgovori na{" "}
              <Link href="/kviz" className={styles.inline}>
                kratak kviz
              </Link>
              .
            </p>
          </div>
          <Link href="/paketi" className={styles.allLink}>
            Svi paketi →
          </Link>
        </header>

        <div className={styles.grid}>
          {bundles.slice(0, 3).map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      </div>
    </section>
  );
}
