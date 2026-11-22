export type CartItem = {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string | null;
  ml: number;
  priceRsd: number;
  qty: number;
  /** Bundle (ready-made or build-your-own): perfumes in the bundle; shown as ONE line in the cart. */
  bundleItems?: { id: string; brand: string; name: string }[];
};
