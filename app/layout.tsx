import type { Metadata, Viewport } from "next";
import { getSiteUrl } from "@/shared/config/site";
import TextFitProvider from "@/shared/providers/text-fit-provider";
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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "sr_RS",
    url: siteUrl,
    siteName: "Atelier Dekant",
    title: "Atelier Dekant",
    description:
      "Dekanti parfema, pažljivo birani mirisi i jednostavna online kupovina.",
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
    <html lang="sr">
      <body>
        <TextFitProvider />
        {children}
      </body>
    </html>
  );
}
