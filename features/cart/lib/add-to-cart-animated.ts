import { addToCart } from "@/features/cart/client/cart.storage";
import { flyToCart } from "@/features/cart/lib/fly-to-cart";
import type { CartItem } from "@/features/cart/types";
import { trackAddToCart } from "@/features/analytics/client/track";

/**
 * Adds to the cart, plays the "fly to cart" animation and opens the cart.
 * Used by the product page and the shop quick view.
 */
export function addToCartAnimated(item: CartItem, sourceEl: HTMLElement | null) {
  addToCart(item);
  // Analytics (only if the visitor accepted cookies).
  trackAddToCart({ id: item.id, name: item.name, brand: item.brand, ml: item.ml, price: item.priceRsd, qty: item.qty });

  const cartIcon = document.querySelector("[data-cart-icon]");

  if (sourceEl && cartIcon instanceof HTMLElement) {
    flyToCart(sourceEl, cartIcon);
    window.setTimeout(() => {
      window.dispatchEvent(new Event("cart:open"));
    }, 420);
    return;
  }

  window.dispatchEvent(new Event("cart:open"));
}
