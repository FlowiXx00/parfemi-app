/**
 * Seller details (Serbian consumer protection law requires them on the site: name, address, tax ID,
 * registry number, contact).
 * Set in .env (NEXT_PUBLIC_COMPANY_*); shown in the footer and on the legal pages.
 */
export const COMPANY = {
  brand: "Atelier Dekant",
  /** Full registered name from APR, e.g. "Marko Marković PR Atelier Dekant Beograd" */
  legalName: process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || "",
  taxId: process.env.NEXT_PUBLIC_COMPANY_PIB?.trim() || "",
  registryNumber: process.env.NEXT_PUBLIC_COMPANY_MB?.trim() || "",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL?.trim() || "info@atelierdekant.rs",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE?.trim() || "+381 62 803 0775",
};

/** Only full https links (anything else is ignored, so a typo in .env can't break the footer). */
function httpsUrl(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  try {
    return new URL(trimmed).protocol === "https:" ? trimmed : "";
  } catch {
    return "";
  }
}

/**
 * Social profiles (NEXT_PUBLIC_INSTAGRAM_URL, NEXT_PUBLIC_TIKTOK_URL, NEXT_PUBLIC_FACEBOOK_URL):
 * footer icons and "sameAs" in the structured data. Unset = not shown.
 */
export const SOCIAL_LINKS = [
  { key: "instagram", label: "Instagram", url: httpsUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL) },
  { key: "tiktok", label: "TikTok", url: httpsUrl(process.env.NEXT_PUBLIC_TIKTOK_URL) },
  { key: "facebook", label: "Facebook", url: httpsUrl(process.env.NEXT_PUBLIC_FACEBOOK_URL) },
].filter((link) => link.url);

/** Seller name for legal texts (full registered name if set). */
const sellerName = () => COMPANY.legalName || COMPANY.brand;

/** "Name, address · PIB … · MB …", only the parts that are set. */
export function sellerLine() {
  return [
    [sellerName(), COMPANY.address].filter(Boolean).join(", "),
    COMPANY.taxId && `PIB ${COMPANY.taxId}`,
    COMPANY.registryNumber && `MB ${COMPANY.registryNumber}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
