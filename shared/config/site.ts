const DEFAULT_SITE_URL = "https://atelierdekant.rs";

export function getSiteUrl() {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;

  return rawSiteUrl.replace(/\/+$/, "");
}
