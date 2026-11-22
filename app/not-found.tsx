import type { Metadata } from "next";
import Header from "@/components/layout/site-header/site-header";
import Footer from "@/components/layout/footer/footer";
import NotFoundContent from "@/features/content/components/status-page/not-found-content";

export const metadata: Metadata = {
  title: "Stranica nije pronađena",
};

/**
 * 404 for URLs that don't exist anywhere in the app. Rendered only inside the root layout
 * (without the (site) layout), so it adds the header and footer itself.
 * notFound() inside the storefront (e.g. a perfume that's off sale) uses app/(site)/not-found.tsx.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <div className="siteShell">
        <NotFoundContent />
      </div>
      <Footer />
    </>
  );
}
