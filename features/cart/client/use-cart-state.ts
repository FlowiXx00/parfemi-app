"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  subscribeCart,
} from "@/features/cart/client/cart.storage";

/**
 * Cart from localStorage, safe for server rendering:
 * the server and the first render see an empty cart (no "Hydration failed" error),
 * then right away, and on every change (addToCart, another tab…), React reads the real cart.
 */
export function useCartState() {
  const cartItems = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  /** Manual refresh (e.g. before opening the drawer); otherwise the cart updates itself. */
  const refreshCart = useCallback(() => {
    window.dispatchEvent(new Event("cart:updated"));
  }, []);

  return { cartItems, cartCount, refreshCart };
}
