"use client";

import { useRef } from "react";
import { useBottleImage, useInViewOnce } from "@/features/shop/client/use-bottle-image";
import { PRODUCT_IMAGE_FALLBACK } from "@/features/shop/lib/product-images";
import EmptyBottle from "./empty-bottle";

/**
 * Small bottle image for bundles and lists: same processing as the shop cards
 * (white background removed, empty space cropped), so all bottles look consistent.
 * Processing starts only when the image is near the viewport.
 */
export default function BottleImg({ src, className }: { src: string; className?: string | undefined }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInViewOnce(ref);
  const bottle = useBottleImage(src, 384, inView);
  const missing = src === PRODUCT_IMAGE_FALLBACK || (bottle.ready && bottle.src === PRODUCT_IMAGE_FALLBACK);

  return (
    <span ref={ref} className={className} aria-hidden="true">
      {missing ? (
        // Perfume without an image: a bottle outline instead of an empty spot.
        <EmptyBottle />
      ) : bottle.ready && bottle.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- obrađena slika je blob: URL
        <img src={bottle.src} alt="" draggable={false} />
      ) : null}
    </span>
  );
}
