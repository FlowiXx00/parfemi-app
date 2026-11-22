import { ImageResponse } from "next/og";
import { getProductById } from "@/db/queries/perfumes";
import { bottlePngDataUrl } from "@/features/shop/server/og-image";
import { formatRsd, getPriceBounds } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";

/** Card shown when a perfume link is shared on Viber / WhatsApp / Instagram / Facebook. */
export const alt = "Dekant parfema — Atelier Dekant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const GOLD = "#d2b070";
const MUTED = "#a7a39b";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id).catch(() => null);
  const host = getSiteUrl().replace(/^https?:\/\//, "");

  const bottle = product ? await bottlePngDataUrl(product.images[0]?.url) : null;
  const { min } = product ? getPriceBounds(product.variants) : { min: 0 };
  const sizes = product ? product.variants.map((variant) => variant.ml).join(" · ") : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: 40,
          background: "radial-gradient(900px 500px at 85% 0%, rgba(210,176,112,0.22), transparent 70%), #0b0d11",
          color: "#f3efe7",
        }}
      >
        {/* Bottle on a white "display case" (most product photos are shot on white) */}
        <div
          style={{
            width: 440,
            height: 550,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 32,
            background: "#ffffff",
            boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
          }}
        >
          {bottle ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bottle} alt="" style={{ maxWidth: 380, maxHeight: 480, objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", width: 90, height: 90, background: GOLD, transform: "rotate(45deg)", borderRadius: 12 }} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: 550 }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, color: GOLD, textTransform: "uppercase" }}>
            {product?.brand ?? "Atelier Dekant"}
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 68, lineHeight: 1.05, letterSpacing: -2 }}>
            {product?.name ?? "Dekanti originalnih parfema"}
          </div>
          {product && (
            <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: MUTED }}>
              {[product.concentration, product.gender].filter(Boolean).join(" · ")}
            </div>
          )}

          <div style={{ display: "flex", flex: 1 }} />

          {product && min > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 30, color: MUTED }}>od</span>
              <span style={{ fontSize: 64, color: GOLD }}>{formatRsd(min)}</span>
            </div>
          )}
          {sizes && (
            <div style={{ display: "flex", marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "1px solid rgba(210,176,112,0.5)",
                  background: "rgba(210,176,112,0.12)",
                  fontSize: 24,
                  color: "#f0d9a6",
                }}
              >
                Dekanti {sizes} ml
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 34,
              paddingTop: 22,
              borderTop: "1px solid rgba(255,255,255,0.1)",
              fontSize: 24,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 14, color: "#f3efe7" }}>
              <span style={{ display: "flex", width: 14, height: 14, background: GOLD, transform: "rotate(45deg)" }} />
              Atelier Dekant
            </span>
            <span style={{ display: "flex", color: MUTED }}>{host}</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
