export type CartItem = {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string | null;
  ml: number;
  priceRsd: number;
  qty: number;
};