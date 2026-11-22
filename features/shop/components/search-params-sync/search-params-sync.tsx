"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Reports the current query string (?q=...&ml=...) to the parent.
 *
 * Why a separate component: useSearchParams on a static page makes Next render
 * the whole component in the browser only (products wouldn't be in the HTML -> bad for SEO).
 * This way only this tiny part waits for the browser and the rest of the page is static HTML.
 */
function Sync({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    onChange(new URLSearchParams(search));
  }, [search, onChange]);

  return null;
}

export default function SearchParamsSync({
  onChange,
}: {
  onChange: (params: URLSearchParams) => void;
}) {
  return (
    <Suspense fallback={null}>
      <Sync onChange={onChange} />
    </Suspense>
  );
}
