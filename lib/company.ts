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
