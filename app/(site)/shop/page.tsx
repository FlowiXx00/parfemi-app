import ShopClient from "@/features/shop/components/shop-page/shop-page-client";
import { getProducts } from "@/features/shop/server/catalog.service";
import { getWishlistProductIds } from "@/features/wishlist/server/get-wishlist-product-ids";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";

  const [products, wishlistIds] = await Promise.all([
    getProducts(),
    getWishlistProductIds(),
  ]);

  return (
    <ShopClient
      initialProducts={products ?? []}
      initialQuery={q}
      initialWishlistIds={wishlistIds}
    />
  );
}