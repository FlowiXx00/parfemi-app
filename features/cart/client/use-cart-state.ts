"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readCart } from "@/features/cart/client/cart.storage";
import type { CartItem } from "@/features/cart/types";

export function useCartState() {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readCart());

  const refreshCart = useCallback(() => {
    setCartItems(readCart());
  }, []);

  useEffect(() => {
    window.addEventListener("focus", refreshCart);
    window.addEventListener("storage", refreshCart);
    window.addEventListener("cart:updated", refreshCart);

    return () => {
      window.removeEventListener("focus", refreshCart);
      window.removeEventListener("storage", refreshCart);
      window.removeEventListener("cart:updated", refreshCart);
    };
  }, [refreshCart]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  return {
    cartItems,
    cartCount,
    refreshCart,
    setCartItems,
  };
}
