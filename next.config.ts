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

/**
 * The image optimizer works only for our own perfume images (Supabase Storage, bucket "perfume-images").
 * With "any https site" anyone could use /_next/image as a free image proxy and use up the shop's image
 * quota. Images the admin links from elsewhere are copied to our Storage on save; one that couldn't be
 * copied is shown without optimization (canOptimizeImage).
 */
function perfumeImagesPattern() {
  const pathname = "/storage/v1/object/public/perfume-images/**";
  try {
    return { protocol: "https" as const, hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname, pathname };
  } catch {
    return { protocol: "https" as const, hostname: "*.supabase.co", pathname };
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The "N" dev indicator (npm run dev only) on the right; the bottom-left corner is taken by the chat
  // bubble.
  devIndicators: { position: "bottom-right" },
  images: {
    remotePatterns: [perfumeImagesPattern()],
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
