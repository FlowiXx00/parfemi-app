import type { CartItem } from "@/features/cart/types";

const CART_KEY = "cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

/* -------------------------------------------------------------------------- */
/* Cart as an "external store" for React (useSyncExternalStore) */
/* The server and the first browser render see an empty cart (same HTML -> no */
/* hydration error); right after that React reads the real cart. */
/* -------------------------------------------------------------------------- */

const EMPTY_CART: CartItem[] = [];
let cachedRaw: string | null = null;
let cachedCart: CartItem[] = EMPTY_CART;

/** Same array (same object) until the cart contents change, as useSyncExternalStore requires. */
export function getCartSnapshot(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CART_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCart = raw ? readCart() : EMPTY_CART;
  }
  return cachedCart;
}

export function getServerCartSnapshot(): CartItem[] {
  return EMPTY_CART;
}

/** Notifies React when the cart changes (this tab, another tab, window refocus). */
export function subscribeCart(onChange: () => void) {
  window.addEventListener("cart:updated", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("cart:updated", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function addToCart(item: CartItem) {
  const cart = readCart();

  const existing = cart.find((x) => x.id === item.id && x.ml === item.ml);

  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push(item);
  }

  writeCart(cart);
  window.dispatchEvent(new Event("cart:updated"));
}

export function incCartItem(id: string, ml: number) {
  const cart = readCart();
  const item = cart.find((x) => x.id === id && x.ml === ml);

  if (!item) return;

  item.qty += 1;
  writeCart(cart);
  window.dispatchEvent(new Event("cart:updated"));
}

export function decCartItem(id: string, ml: number) {
  const cart = readCart();
  const item = cart.find((x) => x.id === id && x.ml === ml);

  if (!item) return;

  item.qty -= 1;

  const next = cart.filter((x) => !(x.id === id && x.ml === ml && x.qty <= 0));
  writeCart(next);
  window.dispatchEvent(new Event("cart:updated"));
}

/**
 * Changes the volume of a cart line (e.g. 10 ml -> 5 ml) and its price.
 * If the cart already has the same perfume in the new volume, the lines are merged.
 */
export function changeCartItemMl(id: string, fromMl: number, toMl: number, priceRsd: number) {
  if (fromMl === toMl) return;

  const cart = readCart();
  const item = cart.find((x) => x.id === id && x.ml === fromMl);
  if (!item) return;

  const target = cart.find((x) => x.id === id && x.ml === toMl);

  let next: CartItem[];
  if (target) {
    target.qty += item.qty;
    target.priceRsd = priceRsd;
    next = cart.filter((x) => x !== item);
  } else {
    item.ml = toMl;
    item.priceRsd = priceRsd;
    next = cart;
  }

  writeCart(next);
  window.dispatchEvent(new Event("cart:updated"));
}

export function removeCartItem(id: string, ml: number) {
  const cart = readCart().filter((x) => !(x.id === id && x.ml === ml));
  writeCart(cart);
  window.dispatchEvent(new Event("cart:updated"));
}

export function clearCart() {
  writeCart([]);
  window.dispatchEvent(new Event("cart:updated"));
}