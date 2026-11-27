import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

/**
 * Crawlers that copy content for AI training or competitor analysis get nothing. Search engines
 * (Google, Bing…) and AI search assistants that send customers (ChatGPT search, Perplexity) still see
 * the shop. robots.txt is only a request that polite crawlers follow; Vercel's "AI Bots" firewall rule
 * enforces it (docs/DEPLOYMENT.md).
 */
const BLOCKED_CRAWLERS = [
  // AI training
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "FacebookBot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "Timpibot",
  "AI2Bot",
  "PanguBot",
  "img2dataset",
  // SEO tools and scrapers
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "Scrapy",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/login", "/register", "/forgot-password", "/reset-password"],
      },
      {
        userAgent: BLOCKED_CRAWLERS,
        disallow: "/",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
