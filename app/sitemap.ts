import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { getProducts } from "@/db/queries/perfumes";

const siteUrl = getSiteUrl();

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes = [
    "",
    "/shop",
    "/paketi",
    "/kviz",
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

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${siteUrl}${route || "/"}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/shop" ? "daily" : "monthly",
    priority: route === "" ? 1 : route === "/shop" ? 0.9 : 0.6,
  }));

  try {
    const products = await getProducts();
    const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
      url: `${siteUrl}/shop/${product.id}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticEntries, ...productEntries];
  } catch {
    return staticEntries;
  }
}
