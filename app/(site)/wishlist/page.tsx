import WishlistPageView from "@/features/wishlist/components/wishlist-page-view/wishlist-page-view";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Lista želja");

export default function WishlistPage() {
  return <WishlistPageView />;
}