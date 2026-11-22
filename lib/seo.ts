import type { Metadata } from "next";

/**
 * Page metadata: title, description, canonical and Open Graph in one place.
 * `noindex` for private pages (cart, account, sign-in) so Google keeps them out of search.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} | Atelier Dekant`, description, url: path },
    twitter: { title: `${title} | Atelier Dekant`, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Private pages: title and noindex only (no canonical or search description). */
export function privatePageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
