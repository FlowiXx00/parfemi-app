import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/shared/config/site";

const siteUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/login", "/register", "/forgot-password", "/reset-password"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
