import CartPageClient from "@/features/cart/components/cart-page/cart-page";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Korpa");

export default function CartPage() {
  return <CartPageClient />;
}
