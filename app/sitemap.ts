import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://atelierdekant.rs";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/shop",
    "/about",
    "/contact",
    "/faq",
    "/how-to-buy",
    "/shipping",
    "/returns",
    "/privacy-policy",
    "/terms-and-conditions",
    "/cookie-policy",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route || "/"}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/shop" ? "daily" : "monthly",
    priority: route === "" ? 1 : route === "/shop" ? 0.9 : 0.6,
  }));
}
