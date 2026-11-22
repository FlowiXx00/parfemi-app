"use client";

import { useEffect, useState } from "react";
import {
  FALLBACK_LIQUID_COLOR,
  processBottleImage,
  type BottleImageWidth,
  type ProcessedBottle,
} from "@/features/shop/lib/bottle-image";

/**
 * Bottle image without the white background + liquid color.
 * `enabled` = false postpones processing (e.g. until the card is on screen).
 */
export function useBottleImage(
  src: string,
  width: BottleImageWidth,
  enabled = true
) {
  const key = `${width}|${src}`;
  const [result, setResult] = useState<(ProcessedBottle & { key: string }) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    void processBottleImage(src, width).then((processed) => {
      if (active) setResult({ ...processed, key: `${width}|${src}` });
    });

    return () => {
      active = false;
    };
  }, [src, width, enabled]);

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
