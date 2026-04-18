import type { CartItem } from "@/features/cart/types";

const CART_KEY = "cart";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function getCartCount() {
  const items = readCart();
  return items.reduce((sum, item) => sum + item.qty, 0);
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

export function removeCartItem(id: string, ml: number) {
  const cart = readCart().filter((x) => !(x.id === id && x.ml === ml));
  writeCart(cart);
  window.dispatchEvent(new Event("cart:updated"));
}

export function clearCart() {
  writeCart([]);
  window.dispatchEvent(new Event("cart:updated"));
}