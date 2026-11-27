import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { classifyCatalogRequest } from "@/lib/bot-guard";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0";
// A phone brand that contains "bot" in its name.
const CUBOT =
  "Mozilla/5.0 (Linux; Android 11; CUBOT X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
// Our Playwright E2E tests and Lighthouse/PageSpeed must keep working.
const HEADLESS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/142.0.0.0 Safari/537.36";
const LIGHTHOUSE =
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse";

function headers(userAgent: string | null, extra: Record<string, string> = {}) {
  const result = new Headers(extra);
  if (userAgent !== null) result.set("user-agent", userAgent);
  return result;
}

describe("classifyCatalogRequest", () => {
  it("lets browsers through, with or without Sec-Fetch headers (older Safari sends none)", () => {
    for (const userAgent of [CHROME, IPHONE, INSTAGRAM, CUBOT, HEADLESS, LIGHTHOUSE]) {
      expect(classifyCatalogRequest(headers(userAgent, { "sec-fetch-site": "same-origin" }))).toBe("browser");
      expect(classifyCatalogRequest(headers(userAgent))).toBe("browser");
    }
  });

  it("refuses scripts and HTTP libraries with their default user agent", () => {
    expect(classifyCatalogRequest(headers(null))).toBe("no-user-agent");
    for (const userAgent of [
      "curl/8.7.1",
      "Wget/1.21.4",
      "python-requests/2.32.3",
      "Python-urllib/3.12",
      "Go-http-client/2.0",
      "Java/21.0.2",
      "node",
      "axios/1.7.2",
      "Scrapy/2.11.2 (+https://scrapy.org)",
      "PostmanRuntime/7.39.0",
    ]) {
      expect(classifyCatalogRequest(headers(userAgent))).toBe("not-a-browser");
    }
  });

  it("refuses crawlers and tools that start with Mozilla/", () => {
    for (const userAgent of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
      "Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26100; sr-Latn-RS) WindowsPowerShell/5.1.26100.1",
    ]) {
      expect(classifyCatalogRequest(headers(userAgent))).toBe("automated");
    }
  });

  it("refuses scripts on other websites but not our own pages or a typed URL", () => {
    expect(classifyCatalogRequest(headers(CHROME, { "sec-fetch-site": "cross-site" }))).toBe("cross-site");
    expect(classifyCatalogRequest(headers(CHROME, { "sec-fetch-site": "same-site" }))).toBe("browser");
    expect(classifyCatalogRequest(headers(CHROME, { "sec-fetch-site": "none" }))).toBe("browser");
  });
});

describe("robots.txt", () => {
  it("keeps the shop open to search engines and closes it to AI-training and SEO crawlers", () => {
    const rules = [robots().rules].flat();
    const everyone = rules.find((rule) => rule.userAgent === "*");
    const blocked = rules.find((rule) => Array.isArray(rule.userAgent));

    expect(everyone?.allow).toBe("/");
    expect(everyone?.disallow).toContain("/api");
    expect(blocked?.disallow).toBe("/");
    expect(blocked?.userAgent).toEqual(expect.arrayContaining(["GPTBot", "ClaudeBot", "CCBot", "AhrefsBot"]));
    for (const searchEngine of ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot"]) {
      expect(blocked?.userAgent).not.toContain(searchEngine);
    }
  });
});
