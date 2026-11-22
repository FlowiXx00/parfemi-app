import type { ShopProduct } from "@/features/shop/types";

/** Sales rank; perfumes without sales go last. */
export const salesOrder = (product: Pick<ShopProduct, "salesRank">) => product.salesRank ?? Number.MAX_SAFE_INTEGER;

/**
 * "Recommended" order: featured first, then best sellers, then most popular (Fragrantica votes).
 * The same on the server (first 24 in the HTML) and in the browser (full catalog), so the list doesn't
 * jump when the catalog arrives.
 */
export function compareRecommended(left: ShopProduct, right: ShopProduct) {
  const featuredDiff = Number(right.isFeatured) - Number(left.isFeatured);
  if (featuredDiff !== 0) return featuredDiff;

  const salesDiff = salesOrder(left) - salesOrder(right);
  if (salesDiff !== 0) return salesDiff;

  const votesDiff = (right.votes ?? 0) - (left.votes ?? 0);
  if (votesDiff !== 0) return votesDiff;

  return left.name.localeCompare(right.name);
}
