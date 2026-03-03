import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Header from "./components/Header/header";
import Footer from "./components/Footer/footer";
import FlyToCartLayer from "./components/FlyToCartLayer/FlyToCartLayer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dush Dekant",
  description: "Dekanti parfema",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <FlyToCartLayer />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}