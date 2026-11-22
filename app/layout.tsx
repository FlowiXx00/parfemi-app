import type { Metadata, Viewport } from "next";
import { getSiteUrl } from "@/lib/site";
import TextFitProvider from "@/components/providers/text-fit-provider";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Atelier Dekant",
    template: "%s | Atelier Dekant",
  },
  description:
    "Dekanti parfema, pažljivo birani mirisi i jednostavna online kupovina.",
  applicationName: "Atelier Dekant",
  // No canonical here: every page without its own would inherit it (Google would see them as copies of the
  // home page).
  openGraph: {
    type: "website",
    locale: "sr_RS",
    url: siteUrl,
    siteName: "Atelier Dekant",
    title: "Atelier Dekant",
    description:
      "Dekanti parfema, pažljivo birani mirisi i jednostavna online kupovina.",
    // Share image: app/opengraph-image.tsx (plus a dedicated one per perfume)
  },
  twitter: {
    card: "summary_large_image",
    title: "Atelier Dekant",
    description:
      "Dekanti parfema, pažljivo birani mirisi i jednostavna online kupovina.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1014" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme on <html> is set by a script before React runs (dark admin / theme choice), so it differs
    // from the server HTML.
    <html lang="sr" suppressHydrationWarning>
      <body>
        <TextFitProvider />
        {children}
      </body>
    </html>
  );
}
