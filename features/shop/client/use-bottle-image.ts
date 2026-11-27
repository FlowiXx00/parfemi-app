"use client";

import { useEffect, useState } from "react";
import {
  FALLBACK_LIQUID_COLOR,
  processBottleImage,
  type BottleImageWidth,
  type ProcessedBottle,
} from "@/features/shop/lib/bottle-image";

/** Image already processed on the server (features/shop/lib/cutout.ts). */
export type PrecomputedBottle = { src: string; color: string | null };

/**
 * Bottle image without the white background + liquid color.
 * With `precomputed` (made once on the server) nothing is processed in the browser at all; otherwise
 * the image is processed here. `enabled` = false postpones processing (e.g. until the card is on screen).
 */
export function useBottleImage(
  src: string,
  width: BottleImageWidth,
  enabled = true,
  precomputed: PrecomputedBottle | null = null
) {
  const key = `${width}|${src}`;
  const [result, setResult] = useState<(ProcessedBottle & { key: string }) | null>(null);
  const hasPrecomputed = precomputed !== null;

  useEffect(() => {
    if (!enabled || hasPrecomputed) return;

    let active = true;

    void processBottleImage(src, width).then((processed) => {
      if (active) setResult({ ...processed, key: `${width}|${src}` });
    });

    return () => {
      active = false;
    };
  }, [src, width, enabled, hasPrecomputed]);

  if (precomputed) {
    return { src: precomputed.src, color: precomputed.color ?? FALLBACK_LIQUID_COLOR, ready: true };
  }

  // The result is only valid for the image it was made for.
  const current = result?.key === key ? result : null;

  return {
    src: current?.src ?? null,
    color: current?.color ?? FALLBACK_LIQUID_COLOR,
    ready: current !== null,
  };
}

/** true once the element first enters the viewport (stays true afterwards). */
export function useInViewOnce<T extends Element>(ref: React.RefObject<T | null>) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;

    if (typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, inView]);

  return inView;
}
