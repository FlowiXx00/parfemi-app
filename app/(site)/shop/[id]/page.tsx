import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById, getProducts } from "@/db/queries/perfumes";
import { getProductReviews } from "@/db/queries/reviews";
import {
  EMPTY_PRODUCT_REVIEWS,
  reviewsStructuredData,
  type ProductReviews,
} from "@/features/reviews/lib/reviews";
import type { CatalogProduct, Product } from "@/features/shop/types";
import { findSimilar } from "@/features/shop/lib/similar";
import { prepareRichText } from "@/lib/rich-text";
import { getSiteUrl } from "@/lib/site";
import DetailsClient from "@/features/shop/components/product-details/product-details-client";

// Only the most popular perfumes are prebuilt (the catalog has 1000+); the rest render on first visit and
// are then cached.
export const revalidate = 300;
export const dynamicParams = true;
const PREBUILT_PRODUCT_PAGES = 60;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.slice(0, PREBUILT_PRODUCT_PAGES).map((product) => ({ id: product.id }));
}

const getProduct = cache(getProductById);
const DEFAULT_PRODUCT_DESCRIPTION =
  "Dekant originalnog parfema u prakticnoj zapremini za testiranje pre kupovine cele bocice.";
const META_DESCRIPTION_MAX_LENGTH = 155;

function truncateMetaDescription(value: string) {
  if (value.length <= META_DESCRIPTION_MAX_LENGTH) {
    return value;
  }

  const trimmed = value
    .slice(0, META_DESCRIPTION_MAX_LENGTH - 1)
    .replace(/\s+\S*$/, "")
    .trim();

  return `${trimmed || value.slice(0, META_DESCRIPTION_MAX_LENGTH - 1)}…`;
}

function richTextToPlainText(value: string | null | undefined) {
  return prepareRichText(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h3|h4|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getPriceSummary(product: Product) {
  const prices = product.variants
    .map((variant) => variant.priceRsd)
    .filter((price) => Number.isFinite(price) && price > 0);

  if (!prices.length) {
    return "";
  }

  const formatter = new Intl.NumberFormat("sr-RS");
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max
    ? `${formatter.format(min)} rsd`
    : `${formatter.format(min)}-${formatter.format(max)} rsd`;
}

function getProductMetaDescription(product: Product) {
  const plainDescription = richTextToPlainText(product.description);
  const priceSummary = getPriceSummary(product);

  return truncateMetaDescription(
    plainDescription ||
      `${product.brand} ${product.name} dekant. Dostupne zapremine, stanje i cena ${
        priceSummary ? `od ${priceSummary}` : "su prikazani"
      } na stranici proizvoda.`
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return {
      title: "Parfem nije pronadjen",
      description: DEFAULT_PRODUCT_DESCRIPTION,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${product.brand} ${product.name} dekant`;
  const description = getProductMetaDescription(product);
  const url = `/shop/${product.id}`;

  // The share image is generated in opengraph-image.tsx (bottle, name, price); this is text only.
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Structured data for Google (schema.org Product): name, brand, image, prices per volume and the
 * reviews of this shop's verified customers (aggregateRating + the newest reviews).
 * The Fragrantica rating is NOT included: Google requires ratings in this markup to come from this
 * site's own customers.
 */
function productJsonLd(product: Product, reviews: ProductReviews) {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/shop/${product.id}`;
  const prices = product.variants.map((variant) => variant.priceRsd).filter((price) => price > 0);
  const anyInStock = product.variants.some((variant) => variant.inStock);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.brand} ${product.name} — dekant`,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((image) => image.url).slice(0, 3),
    description: getProductMetaDescription(product),
    sku: product.id,
    url,
    ...(prices.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "RSD",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: prices.length,
            availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url,
          },
        }
      : {}),
    ...reviewsStructuredData(reviews),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) return notFound();

  const [catalog, reviews] = await Promise.all([
    getProducts().catch(() => []),
    // Reviews are cached per perfume; if they can't be loaded the page still renders (without them).
    getProductReviews(product.id).catch((error: unknown) => {
      console.error("Recenzije nisu učitane:", error);
      return EMPTY_PRODUCT_REVIEWS;
    }),
  ]);

  // Similar perfumes from the cached catalog (no extra query); cards don't need description or notes.
  const similar: CatalogProduct[] = findSimilar(product, catalog).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ description, notes, ...rest }) => rest
  );

  return (
    <>
      <script
        type="application/ld+json"
        // "<" -> < so text from the database can't close the <script> tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, reviews)).replace(/</g, "\\u003c") }}
      />
      {/* key: switching to another perfume mounts a fresh component (resets gallery, quantity and selected volume). */}
      <DetailsClient key={product.id} product={product} similar={similar} reviews={reviews} />
    </>
  );
}
