import "server-only";
import { getActiveBundles } from "@/db/queries/bundles";
import { getProducts } from "@/db/queries/perfumes";
import { getPrimaryImage } from "@/features/shop/lib/product-images";
import { cutoutFor } from "@/features/shop/lib/cutout";
import { priceBundle } from "./bundles";

export type BundleView = {
  id: string;
  title: string;
  description: string;
  ml: number;
  discountPct: number;
  regular: number;
  price: number;
  available: boolean;
  /** cutout = bottle image already processed on the server (null = processed in the browser). */
  items: { id: string; brand: string; name: string; image: string; cutout: { src: string; color: string | null } | null }[];
};

/** Active bundles with their perfumes and current price (from the cached catalog, stock-aware). */
export async function getBundleViews(): Promise<BundleView[]> {
  const [bundles, catalog] = await Promise.all([getActiveBundles(), getProducts().catch(() => [])]);
  const byId = new Map(catalog.map((product) => [product.id, product]));

  return bundles
    .map((bundle) => {
      const priced = priceBundle(bundle.perfume_ids, catalog, bundle.ml, bundle.discount_pct);
      const items = bundle.perfume_ids
        .map((id) => byId.get(id))
        .filter((product) => product !== undefined)
        .map((product) => ({
          id: product.id,
          brand: product.brand,
          name: product.name,
          image: getPrimaryImage(product),
          cutout: cutoutFor(product, 384),
        }));
      return {
        id: bundle.id,
        title: bundle.title,
        description: bundle.description,
        ml: bundle.ml,
        discountPct: bundle.discount_pct,
        regular: priced.regular,
        price: priced.price,
        available: priced.available,
        items,
      };
    })
    // Bundles with a hidden or deleted perfume aren't shown.
    .filter((view) => view.items.length >= 2);
}
