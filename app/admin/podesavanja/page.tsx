import type { Metadata } from "next";
import ShopSettingsAdmin from "@/features/admin/settings/components/shop-settings/shop-settings";
import MarketingContacts from "@/features/admin/settings/components/marketing-contacts/marketing-contacts";
import BottleCutouts from "@/features/admin/settings/components/bottle-cutouts/bottle-cutouts";
import { getAdminContext } from "@/features/admin/server/admin-context";

export const metadata: Metadata = {
  title: "Podešavanja",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const { isDemo } = await getAdminContext();

  return (
    <>
      <ShopSettingsAdmin />
      <BottleCutouts isDemo={isDemo} />
      <MarketingContacts isDemo={isDemo} />
    </>
  );
}
