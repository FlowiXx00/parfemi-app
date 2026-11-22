import type { Metadata } from "next";
import QuickRatings from "@/features/admin/ratings/components/quick-ratings/quick-ratings";

export const metadata: Metadata = {
  title: "Brzi unos ocena",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <QuickRatings />;
}
