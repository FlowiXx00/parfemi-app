export type WishlistItem = {
  id: number;
  user_id: string;
  product_id: string;
  preferred_ml: number | null;
  note: string | null;
  created_at: string;
};