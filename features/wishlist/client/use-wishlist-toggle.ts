"use client";

import { useCallback, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addToWishlist,
  removeFromWishlist,
} from "@/features/wishlist/client/wishlist.api";

/**
 * Heart (wishlist) on cards: optimistic toggle, reverted if the write fails;
 * guests are sent to sign in.
 */
export function useWishlistToggle({
  productId,
  liked,
  isLoggedIn,
  loginHref,
  preferredMl,
  onChange,
}: {
  productId: string;
  liked: boolean;
  isLoggedIn: boolean;
  loginHref: string;
  preferredMl?: number | null;
  onChange: (productId: string, nextLiked: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(
    async (event?: MouseEvent<HTMLElement>) => {
      event?.preventDefault();
      event?.stopPropagation();

      if (!isLoggedIn) {
        router.push(loginHref);
        return;
      }

      if (loading) return;

      const previous = liked;
      onChange(productId, !previous);

      try {
        setLoading(true);

        if (previous) {
          const removed = await removeFromWishlist(productId);
          onChange(productId, removed ? false : previous);
          return;
        }

        const added = await addToWishlist(productId, {
          preferred_ml: preferredMl ?? null,
        });
        onChange(productId, added ? true : previous);
      } catch {
        onChange(productId, previous);
      } finally {
        setLoading(false);
      }
    },
    [isLoggedIn, liked, loading, loginHref, onChange, preferredMl, productId, router]
  );

  return { toggle, loading };
}
