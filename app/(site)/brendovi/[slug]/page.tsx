import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getProducts } from "@/db/queries/perfumes";
import BrandProducts from "@/features/shop/components/brand-page/brand-products";
import { groupByBrand } from "@/features/shop/lib/brands";
import type { CatalogProduct } from "@/features/shop/types";
import { formatRsd } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";
import styles from "@/features/shop/components/brand-page/brand-page.module.css";

// Brand pages are prebuilt and refresh with the catalog (5 min or right after an admin save);
// a brand added later renders on its first visit.
export const revalidate = 300;
export const dynamicParams = true;

const getBrands = cache(async () => groupByBrand(await getProducts().catch(() => [])));

async function getBrand(slug: string) {
  return (await getBrands()).find((brand) => brand.slug === slug) ?? null;
}

export async function generateStaticParams() {
  return (await getBrands()).map((brand) => ({ slug: brand.slug }));
}

function brandFacts(products: CatalogProduct[]) {
  const prices = products.flatMap((product) => product.variants.map((variant) => variant.priceRsd)).filter((price) => price > 0);
  const volumes = products.flatMap((product) => product.variants.map((variant) => variant.ml)).filter((ml) => ml > 0);
  return {
    minPrice: prices.length ? Math.min(...prices) : null,
    minMl: volumes.length ? Math.min(...volumes) : null,
    maxMl: volumes.length ? Math.max(...volumes) : null,
  };
}

/** "3 mirisa", "21 miris", "12 mirisa" */
function scentCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return `${count} ${mod10 === 1 && mod100 !== 11 ? "miris" : "mirisa"}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) return { title: "Brend nije pronađen", robots: { index: false, follow: false } };

  const { minPrice, minMl, maxMl } = brandFacts(brand.products);
  const title = `${brand.name} dekanti`;
  const description = `Dekanti originalnih ${brand.name} parfema: ${scentCount(brand.products.length)}${
    minMl && maxMl ? `, zapremine od ${minMl} do ${maxMl} ml` : ""
  }${minPrice ? `, već od ${formatRsd(minPrice)}` : ""}. Probaj miris pre kupovine cele bočice.`;
  const path = `/brendovi/${brand.slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} | Atelier Dekant`, description, url: path },
    twitter: { title: `${title} | Atelier Dekant`, description },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();

  const { minPrice, minMl, maxMl } = brandFacts(brand.products);
  const siteUrl = getSiteUrl();
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${siteUrl}/shop` },
      { "@type": "ListItem", position: 2, name: "Brendovi", item: `${siteUrl}/brendovi` },
      { "@type": "ListItem", position: 3, name: brand.name, item: `${siteUrl}/brendovi/${brand.slug}` },
    ],
  };

  // Cards don't need descriptions or notes.
  const products: CatalogProduct[] = brand.products.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ description, notes, ...rest }) => rest
  );

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }}
      />
      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Putanja">
          <Link href="/shop">Shop</Link>
          <span aria-hidden="true">/</span>
          <Link href="/brendovi">Brendovi</Link>
          <span aria-hidden="true">/</span>
          <span>{brand.name}</span>
        </nav>

        <header className={styles.header}>
          <span className={styles.kicker}>Brend</span>
          <h1 className={styles.title}>{brand.name} dekanti</h1>
          <p className={styles.lead}>
            {scentCount(brand.products.length)} brenda {brand.name}
            {minMl && maxMl ? ` u dekantima od ${minMl} do ${maxMl} ml` : ""}
            {minPrice ? `, već od ${formatRsd(minPrice)}` : ""}. Originalni parfemi, pretočeni u bočice za probu.
          </p>
        </header>

        <BrandProducts products={products} />

        <p className={styles.more}>
          <Link href="/brendovi">← Svi brendovi</Link>
        </p>
      </div>
    </main>
  );
}
