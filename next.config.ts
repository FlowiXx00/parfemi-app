import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site",
  },
];

/** Images from public/ (logo, sections, local perfume images), cached for 7 days on the CDN. */
const staticAssetCache = {
  key: "Cache-Control",
  value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The "N" dev indicator (npm run dev only) on the right; the bottom-left corner is taken by the chat
  // bubble.
  devIndicators: { position: "bottom-right" },
  images: {
    // Perfume images come from URLs the admin enters (any https site).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
    // Optimized images are cached for 30 days, so the server doesn't reprocess them on every visit.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/images/:path*",
        headers: [staticAssetCache],
      },
      {
        source: "/perfumes/:path*",
        headers: [staticAssetCache],
      },
    ];
  },
};

export default nextConfig;
