import type { Metadata } from "next";
import ShopSettingsAdmin from "@/features/admin/settings/components/shop-settings/shop-settings";

export const metadata: Metadata = {
  title: "Podešavanja",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ShopSettingsAdmin />;
}
