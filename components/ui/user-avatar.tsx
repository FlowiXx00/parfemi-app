"use client";

import { useState, type ReactNode } from "react";

type Props = {
  src: string | null;
  alt: string;
  size: number;
  className?: string | undefined;
  /** What to show when there's no image or it fails to load (initials / icon). */
  fallback: ReactNode;
};

/**
 * Profile picture with a fallback. Google images (lh3.googleusercontent.com) often reject
 * requests that send a Referer, so they're requested without one; if the image still can't
 * load, `fallback` is shown instead of a broken image and alt text.
 */
export default function UserAvatar({ src, alt, size, className, fallback }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    // External links from any domain (Google, data: URL from settings) -> plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}
