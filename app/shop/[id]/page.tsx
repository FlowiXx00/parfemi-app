"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { products } from "@/app/lib/products";
import ProductCard from "@/app/components/ProductCard";
import Header from "@/app/components/Header/header";

function formatRsd(n: number) {
  return new Intl.NumberFormat("sr-RS").format(n) + " rsd";
}

function addToCartLocal(productId: string, ml: number, qty: number) {
  const key = "cart";
  const raw = localStorage.getItem(key);
  const cart: Array<{ productId: string; ml: number; qty: number }> = raw ? JSON.parse(raw) : [];
  const existing = cart.find((x) => x.productId === productId && x.ml === ml);
  if (existing) existing.qty += qty;
  else cart.push({ productId, ml, qty });
  localStorage.setItem(key, JSON.stringify(cart));
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const product = useMemo(
    () => products.find((p) => p.id === params.id),
    [params.id]
  );

  const mlFromUrl = searchParams.get("ml"); // npr "5"
  const [selectedMl, setSelectedMl] = useState<string>(mlFromUrl ?? "");
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"opis" | "info" | "dostava">("opis");
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <div style={{ fontFamily: "system-ui", padding: 24 }}>
        Proizvod nije pronađen. <Link href="/shop">Nazad na Shop</Link>
      </div>
    );
  }

  const selectedVariant = selectedMl
    ? product.variants.find((v) => String(v.ml) === String(selectedMl)) ?? null
    : null;

  const prices = product.variants.map((v) => v.priceRsd);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const rangeText = min === max ? formatRsd(min) : `${formatRsd(min)} - ${formatRsd(max)}`;

  const canAdd = !!selectedVariant && selectedVariant.inStock && qty > 0;

  const recommended = useMemo(
    () => products.filter((p) => p.id !== product.id).slice(0, 4),
    [product.id]
  );

  function onAdd() {
    if (!product || !selectedVariant) return;
    addToCartLocal(product.id, selectedVariant.ml, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  }

return (
    // ✅ FULL WIDTH WHITE WRAPPER (skida crne trake sa strane)
    <div style={{ background: "#fff", color: "#111", minHeight: "100vh" }}>
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "26px 16px",
          fontFamily: "system-ui",
        }}
      >
        {/* Breadcrumb (možeš da popuniš kasnije) */}
        <div style={{ fontSize: 12, color: "#777" }}></div>

      {/* TOP */}
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "120px 1fr 1fr",
          gap: 28,
          alignItems: "start",
        }}
      >
        {/* Left mini column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <div
            style={{
              width: 70,
              height: 70,
              border: "1px solid #eee",
              borderRadius: 12,
              background: "#fafafa",
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
            }}
          >
            <img src={product.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
          </div>

          {/* placeholder za notes grafiku */}
          <div
            style={{
              width: 90,
              height: 190,
              borderRadius: 12,
              border: "1px solid #eee",
              background: "#fff",
              display: "grid",
              placeItems: "center",
              color: "#999",
              fontSize: 12,
            }}
          >
            notes
          </div>
        </div>

        {/* Middle image */}
        <div style={{ display: "grid", placeItems: "center", minHeight: 420 }}>
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: "100%", maxWidth: 420, height: "auto", objectFit: "contain" }}
          />
        </div>

        {/* Right info */}
        <div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.1 }}>{product.name}</h1>
          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700 }}>{rangeText}</div>

          <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: "#444", fontWeight: 800 }}>Količina:</div>

            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <select
                value={selectedMl}
                onChange={(e) => setSelectedMl(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: "10px 12px",
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

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    overflow: "hidden",
                    height: 38,
                  }}
                >
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    style={{ width: 38, height: 38, border: "none", background: "white", cursor: "pointer" }}
                  >
                    −
                  </button>
                  <div style={{ width: 44, textAlign: "center", fontWeight: 800 }}>{qty}</div>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    style={{ width: 38, height: 38, border: "none", background: "white", cursor: "pointer" }}
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={onAdd}
                  disabled={!canAdd}
                  style={{
                    height: 38,
                    padding: "0 16px",
                    borderRadius: 10,
                    border: "1px solid #eee",
                    background: canAdd ? "#000" : "#f2f2f2",
                    color: canAdd ? "#fff" : "#aaa",
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: canAdd ? "pointer" : "not-allowed",
                  }}
                >
                  {added ? "DODATO ✓" : "DODAJ U KORPU"}
                </button>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#444" }}>
                <input type="checkbox" />
                Dodaj u listu želja
              </label>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: "#777", lineHeight: 1.6 }}>
              Kategorije: Komercijalno, {product.gender} <br />
              {product.brand.toLowerCase()}, {product.id.replaceAll("-", " ")}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 30, borderTop: "1px solid #eee" }}>
        <div style={{ display: "flex", gap: 22, justifyContent: "center", fontSize: 12, fontWeight: 900, paddingTop: 14 }}>
          <button
            onClick={() => setTab("opis")}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: tab === "opis" ? "#111" : "#777",
              borderBottom: tab === "opis" ? "2px solid #111" : "2px solid transparent",
              paddingBottom: 10,
            }}
          >
            OPIS
          </button>
          <button
            onClick={() => setTab("info")}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: tab === "info" ? "#111" : "#777",
              borderBottom: tab === "info" ? "2px solid #111" : "2px solid transparent",
              paddingBottom: 10,
            }}
          >
            DODATNE INFORMACIJE
          </button>
          <button
            onClick={() => setTab("dostava")}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: tab === "dostava" ? "#111" : "#777",
              borderBottom: tab === "dostava" ? "2px solid #111" : "2px solid transparent",
              paddingBottom: 10,
            }}
          >
            DOSTAVA
          </button>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 0 0", fontSize: 14, lineHeight: 1.7, color: "#444" }}>
          {tab === "opis" && (
            <>
              <p>(Ovde ide opis parfema.)</p>
              <ul>
                <li>Gornje note: ...</li>
                <li>Srednje note: ...</li>
                <li>Donje note: ...</li>
              </ul>
            </>
          )}
          {tab === "info" && (
            <>
              <p><b>Brend:</b> {product.brand}</p>
              <p><b>Pol:</b> {product.gender}</p>
              <p><b>Koncentracija:</b> {product.concentration}</p>
            </>
          )}
          {tab === "dostava" && <p>Dostava 1–2 radna dana. Pouzećem ili uplata.</p>}
        </div>
      </div>

      {/* Recommended */}
      <div style={{ marginTop: 34 }}>
        <div style={{ fontWeight: 900, letterSpacing: 1, fontSize: 14 }}>PREPORUČENI PROIZVODI</div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 22 }}>
          {recommended.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          </div>
        </div>
      </main>
    </div>
  );
}