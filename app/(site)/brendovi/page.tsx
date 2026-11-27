import Link from "next/link";
import { getProducts } from "@/db/queries/perfumes";
import { brandInitial, groupByBrand } from "@/features/shop/lib/brands";
import { pageMetadata } from "@/lib/seo";
import styles from "@/features/shop/components/brand-page/brand-page.module.css";

// Static page, revalidated with the catalog (5 min or right after an admin save).
export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Brendovi parfema",
  description:
    "Svi brendovi u ponudi Atelier Dekanta: dizajnerski i niche parfemi u dekantima od 3 do 20 ml. Izaberi brend i probaj mirise pre kupovine cele bočice.",
  path: "/brendovi",
});

export default async function BrandsPage() {
  const brands = groupByBrand(await getProducts().catch(() => []));

  // A–Z index: brands under their first letter.
  const letters = new Map<string, typeof brands>();
  for (const brand of brands) {
    const letter = brandInitial(brand.name);
    letters.set(letter, [...(letters.get(letter) ?? []), brand]);
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Putanja">
          <Link href="/shop">Shop</Link>
          <span aria-hidden="true">/</span>
          <span>Brendovi</span>
        </nav>

        <header className={styles.header}>
          <span className={styles.kicker}>{brands.length} brendova</span>
          <h1 className={styles.title}>Brendovi parfema</h1>
          <p className={styles.lead}>
            Dizajnerski i niche brendovi, svi u dekantima. Izaberi brend i probaj mirise pre nego što kupiš celu bočicu.
          </p>
        </header>

        <nav className={styles.letters} aria-label="Slova">
          {[...letters.keys()].map((letter) => (
            <a key={letter} href={`#slovo-${letter}`} className={styles.letterLink}>
              {letter}
            </a>
          ))}
        </nav>

        <div className={styles.index}>
          {[...letters.entries()].map(([letter, group]) => (
            <section key={letter} id={`slovo-${letter}`} className={styles.letterGroup} aria-label={`Slovo ${letter}`}>
              <h2 className={styles.letterTitle}>{letter}</h2>
              <ul className={styles.brandList}>
                {group.map((brand) => (
                  <li key={brand.slug}>
                    <Link href={`/brendovi/${brand.slug}`} className={styles.brandLink}>
                      <span>{brand.name}</span>
                      <span className={styles.brandCount}>{brand.products.length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
