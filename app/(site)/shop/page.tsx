import type { Metadata } from "next";
import ShopClient from "@/features/shop/components/shop-page/shop-page-client";
import { getCatalogList } from "@/db/queries/perfumes";
import { compareRecommended } from "@/features/shop/lib/sort";

// Static page, revalidated every 5 min or right after an admin save.
export const revalidate = 300;

/** How many perfumes go into the HTML (first screen + Google); the browser loads the rest of the catalog. */
const FIRST_PAGE = 24;

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Dekanti originalnih dizajnerskih i niche parfema od 3 do 20 ml — filtriraj po mirisu, sezoni, brendu i ceni.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop parfema | Atelier Dekant",
    description: "Izaberi dekant parfema, proveri dostupne zapremine i poruči online.",
    url: "/shop",
  },
  twitter: {
    title: "Shop parfema | Atelier Dekant",
    description: "Izaberi dekant parfema, proveri dostupne zapremine i poruči online.",
  },
};

export default async function Page() {
  const catalog = await getCatalogList();
  const firstPage = [...catalog].sort(compareRecommended).slice(0, FIRST_PAGE);

  return <ShopClient initialProducts={firstPage} totalCount={catalog.length} />;
}
