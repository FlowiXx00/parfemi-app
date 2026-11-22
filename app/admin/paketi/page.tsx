import type { Metadata } from "next";
import BundlesAdmin from "@/features/admin/bundles/components/bundles-admin/bundles-admin";

export const metadata: Metadata = {
  title: "Paketi",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BundlesAdmin />;
}
