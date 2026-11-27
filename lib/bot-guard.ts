/**
 * A cheap first filter for the catalog JSON (/api/catalog), which holds the whole shop in one response.
 * It refuses requests that clearly don't come from our pages in a browser: scripts and HTTP libraries
 * (curl, wget, Python, Go, Java, Node…), crawlers, and scripts on other websites.
 *
 * Anyone can fake these headers, so this only stops tools with default settings. The real wall is
 * Vercel's Bot Protection in front of the whole site (docs/DEPLOYMENT.md), and the shop tables can't be
 * read with the public Supabase key at all (migration 018).
 */

/** Crawlers announce themselves: "Googlebot/2.1", "GPTBot/1.2", "AhrefsBot/7.0"… and a few without a version. */
const CRAWLER_PATTERN = /\w(?:bot|crawler|spider)\/\d|bytespider|petalbot|facebookexternalhit|slurp|ia_archiver/i;

/** Tools that do send a "Mozilla/…" user agent, or name themselves in one. */
const TOOL_PATTERN =
  /powershell|wkhtmlto|phantomjs|python|curl|wget|httpclient|okhttp|axios|node-fetch|undici|go-http-client|scrapy/i;

export type CatalogRequestVerdict = "browser" | "no-user-agent" | "not-a-browser" | "automated" | "cross-site";

export function classifyCatalogRequest(headers: Headers): CatalogRequestVerdict {
  const userAgent = headers.get("user-agent")?.trim() ?? "";
  if (!userAgent) return "no-user-agent";
  // Every real browser (in-app browsers included) starts with "Mozilla/"; HTTP libraries don't by default.
  if (!userAgent.startsWith("Mozilla/")) return "not-a-browser";
  if (CRAWLER_PATTERN.test(userAgent) || TOOL_PATTERN.test(userAgent)) return "automated";
  // A script on another website (browsers send this header with every request they make).
  if (headers.get("sec-fetch-site") === "cross-site") return "cross-site";
  return "browser";
}
