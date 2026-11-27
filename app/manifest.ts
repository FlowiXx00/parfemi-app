import type { MetadataRoute } from "next";

/** "Add to Home Screen": name, colors and icons (app/icon.tsx) for phones. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atelier Dekant",
    short_name: "Atelier Dekant",
    description: "Dekanti originalnih dizajnerskih i niche parfema od 3 do 20 ml.",
    lang: "sr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0d11",
    theme_color: "#0b0d11",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
