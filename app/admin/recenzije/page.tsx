import type { Metadata } from "next";
import ReviewsAdmin from "@/features/admin/reviews/components/reviews-admin/reviews-admin";

export const metadata: Metadata = {
  title: "Recenzije kupaca",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ReviewsAdmin />;
}
