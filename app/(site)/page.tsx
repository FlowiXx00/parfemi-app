import Hero from "@/features/home/components/hero/hero";
import FeaturedPerfumes from "@/features/home/components/featured-perfumes/featured-perfumes";
import FounderSection from "@/features/home/components/founder-section/founder-section";
import WhatIsSection from "@/features/home/components/what-is-section/what-is-section";
import { getProducts } from "@/db/queries/perfumes";
import BundlesTeaser from "@/features/home/components/bundles-teaser/bundles-teaser";
import { getBundleViews } from "@/features/bundles/lib/views";
import type { CatalogProduct } from "@/features/shop/types";
import { getSiteUrl } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Dekanti originalnih parfema",
  description:
    "Dekanti originalnih dizajnerskih i niche parfema od 3 do 20 ml. Probaj miris na svojoj koži pre kupovine cele bočice — dostava Post Expressom za 1–3 dana.",
  path: "/",
});

// Static page; featured perfumes refresh together with the catalog (5 min or on admin save).
export const revalidate = 300;

const FEATURED_COUNT = 8;
const BRAND_CHIPS = 14;

async function getHomeData() {
  try {
    const products = await getProducts();
    // The catalog is already sorted by Fragrantica votes; take rated, available perfumes that have an
    // image.
    const featured: CatalogProduct[] = products
      .filter((p) => p.rating !== null && p.images.length > 0 && p.variants.some((v) => v.inStock))
      .slice(0, FEATURED_COUNT)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ description, notes, ...rest }) => rest);

    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    const brands = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, BRAND_CHIPS)
      .map(([name, count]) => ({ name, count }));

    return { featured, brands, total: products.length };
  } catch (error) {
    // The home page has to render even if the database is down.
    console.error("Početna: katalog nije učitan:", error);
    return { featured: [], brands: [], total: 0 };
  }
}

/** For Google: who we are (Organization) and how the site is searched (WebSite + shop search). */
function siteJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Atelier Dekant",
        url: siteUrl,
        logo: `${siteUrl}/images/logo-white.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Atelier Dekant",
        url: siteUrl,
        inLanguage: "sr",
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/shop?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export default async function ParfemiPage() {
  const [{ featured, brands, total }, bundles] = await Promise.all([
    getHomeData(),
    getBundleViews().catch(() => []),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()).replace(/</g, "\\u003c") }}
      />
      <Hero />
      <FeaturedPerfumes products={featured} brands={brands} total={total} />
      <BundlesTeaser bundles={bundles.filter((bundle) => bundle.available)} />
      <FounderSection />
      <WhatIsSection />
    </>
  );
}
