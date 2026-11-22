import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getProducts } from "@/db/queries/perfumes";
import { getSiteUrl } from "@/lib/site";

/** Share card for the site (home page and pages without their own card). */
export const alt = "Atelier Dekant — dekanti originalnih parfema";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

const GOLD = "#d2b070";

const logoSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "public/images/logo-white.png"), "base64")}`;

export default async function Image() {
  const products = await getProducts().catch(() => []);
  const sizes = products.flatMap((product) => product.variants.map((variant) => variant.ml)).filter((ml) => ml > 0);
  const host = getSiteUrl().replace(/^https?:\/\//, "");
  // Product count and volume range come from the catalog (always accurate, nothing to update by hand)
  const chips = [
    products.length >= 100 ? `${Math.floor(products.length / 100) * 100}+ parfema` : "Originalni parfemi",
    sizes.length ? `Dekanti od ${Math.min(...sizes)} do ${Math.max(...sizes)} ml` : "Dekanti po meri",
    "Post Express 1–3 dana",
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background:
            "radial-gradient(700px 420px at 100% 0%, rgba(210,176,112,0.28), transparent 70%), radial-gradient(600px 400px at 0% 100%, rgba(210,176,112,0.12), transparent 70%), #0b0d11",
          color: "#f3efe7",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" style={{ height: 72, objectFit: "contain", alignSelf: "flex-start" }} />

        <div style={{ display: "flex", marginTop: 48, fontSize: 26, letterSpacing: 8, color: GOLD }}>
          DEKANTI ORIGINALNIH PARFEMA
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 76, lineHeight: 1.05, letterSpacing: -2, maxWidth: 900 }}>
          Upoznaj miris pre nego što kupiš celu bočicu.
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                padding: "12px 24px",
                borderRadius: 999,
                border: "1px solid rgba(210,176,112,0.5)",
                background: "rgba(210,176,112,0.12)",
                fontSize: 24,
                color: "#f0d9a6",
              }}
            >
              {chip}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", position: "absolute", right: 90, bottom: 50, fontSize: 24, color: "#a7a39b" }}>{host}</div>
      </div>
    ),
    size
  );
}
