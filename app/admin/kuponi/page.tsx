import type { Metadata } from "next";
import CouponsAdmin from "@/features/admin/coupons/components/coupons-admin/coupons-admin";

export const metadata: Metadata = {
  title: "Kuponi",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CouponsAdmin />;
}
