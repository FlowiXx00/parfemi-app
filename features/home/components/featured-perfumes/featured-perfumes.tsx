"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import ShowcaseCard from "@/features/shop/components/showroom/showcase-card";
import type { CatalogProduct } from "@/features/shop/types";
import styles from "./featured-perfumes.module.css";

/** Quick shop entries with a scent/season filter applied (see features/shop/lib/scent-filters). */
const MOOD_LINKS = [
  { label: "Sveži za leto", href: "/shop?miris=svezi&sezona=leto" },
  { label: "Slatki za zimu", href: "/shop?miris=slatki&sezona=zima" },
  { label: "Drvenasti za veče", href: "/shop?miris=drvenasti&sezona=noc" },
  { label: "Cvetni za proleće", href: "/shop?miris=cvetni&sezona=prolece" },
  { label: "Za svaki dan", href: "/shop?miris=svezi&sezona=dan" },
  { label: "Topli i zavodljivi", href: "/shop?miris=topli&sezona=noc" },
  { label: "Ne znaš? Uradi kviz →", href: "/kviz" },
];

type Props = {
  products: CatalogProduct[];
  brands: { name: string; count: number }[];
  total: number;
};

/**
 * Home page: most popular perfumes (most Fragrantica votes; same cards as the shop)
 * + quick links to brands.
 * Clicking a perfume opens its quick view in the shop (/shop?open=id).
 */
export default function FeaturedPerfumes({ products, brands, total }: Props) {
  const router = useRouter();
  const open = useCallback((productId: string) => router.push(`/shop?open=${encodeURIComponent(productId)}`), [router]);

  if (!products.length) return null;

  return (
    <section className={styles.section} aria-labelledby="featured-title">
      <div className={styles.wrap}>
        <header className={styles.head}>
          <div>
            <span className={styles.kicker}>Izdvajamo</span>
            <h2 id="featured-title" className={styles.h2}>
              Najpopularniji parfemi
            </h2>
            <p className={styles.p}>Parfemi koje su ljubitelji na Fragrantici najviše ocenjivali.</p>
          </div>
          <Link href="/shop" className={styles.allLink}>
            Svih {total.toLocaleString("sr-RS")} parfema →
          </Link>
        </header>

        <div className={styles.grid}>
          {products.map((product) => (
            <ShowcaseCard key={product.id} product={product} onOpen={open} />
          ))}
        </div>

        <div className={styles.brands}>
          <span className={styles.brandsLabel}>Po mirisu</span>
          <ul className={styles.brandList}>
            {MOOD_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.brandChip}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {brands.length > 0 && (
          <div className={styles.brands}>
            <span className={styles.brandsLabel}>Brendovi</span>
            <ul className={styles.brandList}>
              {brands.map((brand) => (
                <li key={brand.name}>
                  <Link href={`/shop?q=${encodeURIComponent(brand.name)}`} className={styles.brandChip}>
                    {brand.name}
                    <span>{brand.count}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/shop" className={`${styles.brandChip} ${styles.brandChipAll}`}>
                  Svi brendovi →
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
