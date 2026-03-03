"use client";

import { useMemo, useState } from "react";
import { products as allProducts, type Product } from "@/app/lib/products";

import ProductCard from "@/app/components/ProductCard";
import FlyToCartLayer from "@/app/components/FlyToCartLayer/FlyToCartLayer";

type SortKey = "popularity" | "priceAsc" | "priceDesc" | "nameAsc";

const genders = ["Muški", "Unisex", "Ženski"] as const;
const concentrations = [
  "Eau de cologne",
  "Eau de toilette",
  "Eau de parfum",
  "Extrait de parfum",
  "Parfum",
] as const;

function minPrice(p: Product) {
  return Math.min(...p.variants.map((v) => v.priceRsd));
}
function maxPrice(p: Product) {
  return Math.max(...p.variants.map((v) => v.priceRsd));
}

export default function ShopPage() {
  const brandCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allProducts) {
      map.set(p.brand, (map.get(p.brand) ?? 0) + 1);
    }
    return map;
  }, []);

  const brands = useMemo(() => {
    return Array.from(brandCounts.keys()).sort((a, b) => a.localeCompare(b));
  }, [brandCounts]);

  const globalMin = useMemo(() => Math.min(...allProducts.map(minPrice)), []);
  const globalMax = useMemo(() => Math.max(...allProducts.map(maxPrice)), []);

  const [query, setQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());

  const [selectedGenders, setSelectedGenders] = useState<Set<string>>(new Set());
  const [selectedConcs, setSelectedConcs] = useState<Set<string>>(new Set());
  const [onSaleOnly, setOnSaleOnly] = useState(false);

  const [draftPriceMax, setDraftPriceMax] = useState(globalMax);
  const [priceMaxApplied, setPriceMaxApplied] = useState(globalMax);

  const [perPage, setPerPage] = useState(12);
  const [sort, setSort] = useState<SortKey>("popularity");

  function toggleSet(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string
  ) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setSelectedBrands(new Set());
    setSelectedGenders(new Set());
    setSelectedConcs(new Set());
    setOnSaleOnly(false);
    setDraftPriceMax(globalMax);
    setPriceMaxApplied(globalMax);
    setPerPage(12);
    setSort("popularity");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = allProducts.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q);

      const matchesBrand = selectedBrands.size === 0 || selectedBrands.has(p.brand);
      const matchesPrice = minPrice(p) <= priceMaxApplied;
      const matchesGender = selectedGenders.size === 0 || selectedGenders.has(p.gender);
      const matchesConc = selectedConcs.size === 0 || selectedConcs.has(p.concentration);
      const matchesSale = !onSaleOnly || p.onSale;

      return (
        matchesQuery &&
        matchesBrand &&
        matchesPrice &&
        matchesGender &&
        matchesConc &&
        matchesSale
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "popularity") return b.popularity - a.popularity;
      if (sort === "priceAsc") return minPrice(a) - minPrice(b);
      if (sort === "priceDesc") return minPrice(b) - minPrice(a);
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [
    query,
    selectedBrands,
    selectedGenders,
    selectedConcs,
    onSaleOnly,
    priceMaxApplied,
    sort,
  ]);

  const shown = filtered.slice(0, perPage);

  return (
    <div style={{ fontFamily: "system-ui", background: "#fff", minHeight: "100vh" }}>
      {/* ✅ Responsive CSS (najmanje promene) */}
      <style>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 16px; }
        .layout { margin-top: 18px; display: grid; grid-template-columns: 280px 1fr; gap: 28px; align-items: start; }
        .grid { margin-top: 18px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 12px; gap: 16px; }
        .navLinks { display: flex; gap: 18px; font-size: 13px; color: #333; }

        /* ✅ tablet + mobile */
        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; }
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .navLinks { display: none; } /* sakrij meni na mobilnom */
        }

        /* ✅ bas mali telefoni */
        @media (max-width: 420px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <FlyToCartLayer />


      <main className="wrap">
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700 }}>Shop</h1>

        <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
          <button
            onClick={resetFilters}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "#666",
              textDecoration: "underline",
            }}
          >
            Poništi filtere
          </button>
        </div>

        <div className="layout">
          {/* Sidebar */}
          <aside>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#444", letterSpacing: 0.5 }}>
              PRETRAGA
            </div>
            <div
              style={{
                marginTop: 10,
                border: "1px solid #eee",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pretraži proizvode"
                style={{ border: "none", outline: "none", width: "100%" }}
              />
              <span style={{ color: "#999" }}>⌕</span>
            </div>

            {/* CENA */}
            <div style={{ marginTop: 26, fontSize: 12, fontWeight: 800, color: "#444" }}>
              CENA
            </div>
            <div style={{ marginTop: 12 }}>
              <input
                type="range"
                min={globalMin}
                max={globalMax}
                value={draftPriceMax}
                onChange={(e) => setDraftPriceMax(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
                Cena: <b>{globalMin}</b> rsd — <b>{draftPriceMax}</b> rsd
              </div>

              <button
                onClick={() => setPriceMaxApplied(draftPriceMax)}
                style={{
                  marginTop: 10,
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                FILTER
              </button>

              <button
                onClick={resetFilters}
                style={{
                  marginLeft: 10,
                  background: "white",
                  color: "#111",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>

            {/* BREND */}
            <div style={{ marginTop: 26, fontSize: 12, fontWeight: 800, color: "#444" }}>
              BREND
            </div>
            <div style={{ marginTop: 12, maxHeight: 240, overflow: "auto" }}>
              {brands.map((b) => (
                <label
                  key={b}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "6px 0",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={selectedBrands.has(b)}
                      onChange={() => toggleSet(setSelectedBrands, b)}
                    />
                    <span style={{ fontSize: 13, color: "#666" }}>{b}</span>
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      color: "#777",
                      border: "1px solid #eee",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    {brandCounts.get(b) ?? 0}
                  </span>
                </label>
              ))}
            </div>

            {/* POL */}
            <div style={{ marginTop: 26, fontSize: 12, fontWeight: 800, color: "#444" }}>
              POL
            </div>
            <div style={{ marginTop: 12 }}>
              {genders.map((g) => (
                <label
                  key={g}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedGenders.has(g)}
                    onChange={() => toggleSet(setSelectedGenders, g)}
                  />
                  <span style={{ fontSize: 13, color: "#666" }}>{g}</span>
                </label>
              ))}
            </div>

            {/* KONCENTRACIJA */}
            <div style={{ marginTop: 26, fontSize: 12, fontWeight: 800, color: "#444" }}>
              KONCENTRACIJA
            </div>
            <div style={{ marginTop: 12 }}>
              {concentrations.map((c) => (
                <label
                  key={c}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedConcs.has(c)}
                    onChange={() => toggleSet(setSelectedConcs, c)}
                  />
                  <span style={{ fontSize: 13, color: "#666" }}>{c}</span>
                </label>
              ))}
            </div>

            {/* AKCIJA */}
            <div style={{ marginTop: 26, fontSize: 12, fontWeight: 800, color: "#444" }}>
              AKCIJA
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
              <input
                type="checkbox"
                checked={onSaleOnly}
                onChange={() => setOnSaleOnly(!onSaleOnly)}
              />
              <span style={{ fontSize: 13, color: "#666" }}>Na akciji</span>
            </label>
          </aside>

          {/* Right side */}
          <section>
            {/* Toolbar */}
            <div className="toolbar">
              <div style={{ fontSize: 13, color: "#666" }}>
                Prikaži:&nbsp;
                {[8, 12, 16, 24].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPerPage(n)}
                    style={{
                      marginLeft: 8,
                      fontWeight: perPage === n ? 800 : 500,
                      textDecoration: perPage === n ? "underline" : "none",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: perPage === n ? "#000" : "#666",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#666" }}>Sortiraj:</div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  style={{ border: "1px solid #eee", borderRadius: 10, padding: "8px 10px" }}
                >
                  <option value="popularity">po popularnosti</option>
                  <option value="priceAsc">cena: rastuće</option>
                  <option value="priceDesc">cena: opadajuće</option>
                  <option value="nameAsc">naziv: A–Z</option>
                </select>
              </div>
            </div>

            {/* No results bar */}
            {filtered.length === 0 && (
              <div
                style={{
                  marginTop: 12,
                  background: "#a63a3a",
                  color: "white",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Nijedan proizvod koji odgovara vašem izboru nije pronađen.
              </div>
            )}

            {/* Grid */}
            <div className="grid">
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            <div style={{ marginTop: 14, fontSize: 13, color: "#888" }}>
              Prikazano {shown.length} od {filtered.length}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}