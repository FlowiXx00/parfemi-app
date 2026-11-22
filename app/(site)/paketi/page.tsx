import type { Metadata } from "next";
import Link from "next/link";
import BundleCard from "@/features/bundles/components/bundle-card/bundle-card";
import BundleBuilder from "@/features/bundles/components/bundle-builder/bundle-builder";
import { getBundleViews } from "@/features/bundles/lib/views";
import styles from "./paketi.module.css";

// Refreshes together with the catalog (5 min or right after an admin save).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Paketi za probu",
  description: "Paketi dekanata originalnih parfema po nižoj ceni — probaj više mirisa odjednom.",
  alternates: { canonical: "/paketi" },
};

export default async function PaketiPage() {
  const bundles = await getBundleViews();

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <span className={styles.kicker}>Paketi za probu</span>
        <h1 className={styles.title}>Probaj više mirisa odjednom — jeftinije</h1>
        <p className={styles.lead}>
          Izabrani parfemi u istoj zapremini, spakovani zajedno po nižoj ceni nego pojedinačno. Idealno za upoznavanje
          novih mirisa ili kao poklon.
        </p>
      </header>

      <BundleBuilder />

      <header className={styles.sectionHead}>
        <span className={styles.kicker}>Izabrali smo za tebe</span>
        <h2 className={styles.sectionTitle}>Gotovi paketi</h2>
        <p className={styles.sectionSub}>Složeni po mirisu i prilici — jedan klik i paket je u korpi.</p>
      </header>

      {bundles.length > 0 ? (
        <div className={styles.grid}>
          {bundles.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          Gotovi paketi uskoro stižu — do tada složi svoj iznad, ili pronađi miris kroz <Link href="/kviz">kviz</Link>.
        </div>
      )}
    </main>
  );
}
