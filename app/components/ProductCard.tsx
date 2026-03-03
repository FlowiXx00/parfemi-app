"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/app/lib/products";

function formatRsd(n: number) {
  return new Intl.NumberFormat("sr-RS").format(n) + " rsd";
}

function priceRange(p: Product) {
  const prices = p.variants.map((v) => v.priceRsd);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function Stars({ rating = 0 }: { rating?: number }) {
  const full = Math.floor(rating);
  return (
    <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 6 }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full;
        return (
          <svg
            key={i}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={filled ? "#111" : "none"}
            stroke="#111"
            strokeWidth="1.6"
            style={{ opacity: filled ? 1 : 0.25 }}
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        );
      })}
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const soldOut = product.variants.every((v) => !v.inStock);
  const onSale = product.onSale;

  const { min, max } = useMemo(() => priceRange(product), [product]);
  const [selectedMl, setSelectedMl] = useState<string>("");

  const selectedVariant = useMemo(() => {
    if (!selectedMl) return null;
    const mlNum = Number(selectedMl);
    return product.variants.find((v) => v.ml === mlNum) ?? null;
  }, [selectedMl, product.variants]);

  const priceText = selectedVariant
    ? `${selectedVariant.ml}ml — ${formatRsd(selectedVariant.priceRsd)}`
    : min === max
      ? formatRsd(min)
      : `${formatRsd(min)} - ${formatRsd(max)}`;

  return (
    <div className="pcard">
      {/* malo CSS-a za hover + dugme srce */}
      <style>{`
        .pcard .imgwrap img { transition: transform 250ms ease; }
        .pcard:hover .imgwrap img { transform: scale(1.06); }
        .pcard .wishbtn {
          opacity: 0;
          transform: translateY(-4px);
          transition: opacity 180ms ease, transform 180ms ease;
        }
        .pcard:hover .wishbtn { opacity: 1; transform: translateY(0); }
      `}</style>

      <div
        style={{
          position: "relative",
          border: "1px solid #eee",
          borderRadius: 14,
          overflow: "hidden",
          background: "white",
        }}
      >
        {/* BADGE */}
        {soldOut ? (
          <div
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              background: "#000",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 8px",
              borderRadius: 8,
              zIndex: 2,
            }}
          >
            SOLD OUT
          </div>
        ) : onSale ? (
          <div
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              background: "#000",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 8px",
              borderRadius: 8,
              zIndex: 2,
            }}
          >
            AKCIJA
          </div>
        ) : null}

        {/* ❤️ wishlist (UI za sada) */}
        <button
          className="wishbtn"
          aria-label="Dodaj u listu želja"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            alert("Kasnije: dodaj u listu želja 🙂");
          }}
          style={{
            position: "absolute",
            right: 10,
            top: 10,
            width: 38,
            height: 38,
            borderRadius: 999,
            border: "1px solid #eee",
            background: "white",
            cursor: "pointer",
            zIndex: 3,
            display: "grid",
            placeItems: "center",
          }}
        >
          ♡
        </button>

        {/* Slika klik vodi na detalj */}
        <Link href={`/shop/${product.id}`} style={{ display: "block" }}>
          <div className="imgwrap" style={{ aspectRatio: "1 / 1", background: "#fafafa" }}>
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "contain", padding: 18 }}
              loading="lazy"
            />
          </div>
        </Link>

        <div style={{ padding: 14 }}>
          <select
            disabled={soldOut}
            value={selectedMl}
            onChange={(e) => setSelectedMl(e.target.value)}
            style={{
              width: "100%",
              border: "1px solid #eee",
              borderRadius: 10,
              padding: "10px 10px",
              color: "#333",
              background: "white",
            }}
          >
            <option value="">Izaberi opciju</option>
            {product.variants.map((v) => (
              <option key={v.ml} value={String(v.ml)} disabled={!v.inStock}>
                {v.ml}ml — {formatRsd(v.priceRsd)} {v.inStock ? "" : "(nema)"}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link href={`/shop/${product.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              {/* 2 reda max */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: "18px",
                  height: 36,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
                title={product.name}
              >
                {product.name}
              </div>
            </Link>

            <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>{priceText}</div>

            {/* ✅ Dugme: DETALJI (link), isto kao klik na sliku */}
            <div style={{ marginTop: 10 }}>
  {selectedMl ? (
    <Link
      href={`/shop/${product.id}?ml=${selectedMl}`}
      style={{
        display: "block",
        width: "100%",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid #eee",
        background: "#000",
        color: "#fff",
        textDecoration: "none",
        textAlign: "center",
      }}
    >
      DETALJI
    </Link>
  ) : (
    <div
      style={{
        width: "100%",
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid #eee",
        background: "#f2f2f2",
        color: "#aaa",
        textAlign: "center",
        cursor: "not-allowed",
      }}
      title="Prvo izaberi militražu"
    >
      DETALJI
    </div>
  )}
</div>

            <Stars rating={0} />
          </div>
        </div>
      </div>
    </div>
  );
}