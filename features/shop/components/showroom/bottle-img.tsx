"use client";

import { useRef, useState } from "react";
import { useBottleImage, useInViewOnce, type PrecomputedBottle } from "@/features/shop/client/use-bottle-image";
import { PRODUCT_IMAGE_FALLBACK } from "@/features/shop/lib/product-images";
import EmptyBottle from "./empty-bottle";

/**
 * Small bottle image for bundles and lists: same processing as the shop cards
 * (white background removed, empty space cropped), so all bottles look consistent.
 * A ready-made image from the server is shown as is; otherwise processing starts only when the image is
 * near the viewport.
 */
export default function BottleImg({
  src,
  className,
  precomputed = null,
}: {
  src: string;
  className?: string | undefined;
  precomputed?: PrecomputedBottle | null;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInViewOnce(ref);
  const [cutoutBroken, setCutoutBroken] = useState(false);
  const ready = cutoutBroken ? null : precomputed;
  const bottle = useBottleImage(src, 384, inView, ready);
  const missing = src === PRODUCT_IMAGE_FALLBACK || (bottle.ready && bottle.src === PRODUCT_IMAGE_FALLBACK);

  return (
    <span ref={ref} className={className} aria-hidden="true">
      {missing ? (
        // Perfume without an image: a bottle outline instead of an empty spot.
        <EmptyBottle />
      ) : bottle.ready && bottle.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- obrađena slika je blob: URL ili gotov fajl
        <img
          src={bottle.src}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => ready && setCutoutBroken(true)}
        />
      ) : null}
    </span>
  );
}
