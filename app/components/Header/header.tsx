"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function TopMarquee({ msg }: { msg: string }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    // ==== PODESI OVO ====
    const speed = 170; // px/s
    const gapPx = 40;
    const direction: "rtl" | "ltr" = "rtl"; // rtl = desno -> levo
    // ====================

    let raf = 0;
    let last = performance.now();

    let viewportW = 0;
    let textW = 0;

    const measure = () => {
      viewportW = viewport.getBoundingClientRect().width;
      textW = text.scrollWidth;
    };

    const xRef = { x: 0 };

    const resetOutside = () => {
      xRef.x = direction === "rtl" ? viewportW + gapPx : -textW - gapPx;
      text.style.transform = `translateX(${xRef.x}px)`;
    };

    measure();
    resetOutside();

    const ro = new ResizeObserver(() => {
      measure();
      resetOutside();
    });
    ro.observe(viewport);

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const dirMul = direction === "rtl" ? -1 : 1;
      xRef.x += speed * dt * dirMul;

      if (direction === "rtl") {
        if (xRef.x < -textW - gapPx) xRef.x = viewportW + gapPx;
      } else {
        if (xRef.x > viewportW + gapPx) xRef.x = -textW - gapPx;
      }

      text.style.transform = `translateX(${xRef.x}px)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="mp-top">
      <div ref={viewportRef} className="mp-viewport">
        <span ref={textRef} className="mp-text">
          {msg}
        </span>
      </div>
    </div>
  );
}

export default function Header() {
  const msg =
    "Sigurnost i reputacija na prvom mestu. Hvala na ukazanom poverenju!";

  const [showTop, setShowTop] = useState(true);

  // --- refs za stabilno sakrivanje bez treptanja ---
  const showTopRef = useRef(true);
  const topBarWrapRef = useRef<HTMLDivElement | null>(null);
  const topBarHeightRef = useRef(0);
  const skipScrollRef = useRef(false);

  // držimo ref u sync sa state (da scroll handler nema “stale state”)
  useEffect(() => {
    showTopRef.current = showTop;
  }, [showTop]);

  // merimo visinu top bara dok je prikazan
  useEffect(() => {
    if (!showTop) return;

    const el = topBarWrapRef.current;
    if (!el) return;

    const measure = () => {
      topBarHeightRef.current = el.getBoundingClientRect().height;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => ro.disconnect();
  }, [showTop]);

  // ✅ sakrij na prvi scroll bez treptanja (kompenzacija scrolla)
  useEffect(() => {
    const HIDE_AT = 1; // sakrij čim krene scroll
    const SHOW_AT = 0; // prikaži samo kad si baš na vrhu

    let raf = 0;

    const onScroll = () => {
      if (skipScrollRef.current) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);

        // ako je prikazan i korisnik je skrolovao bar malo -> sakrij
        if (showTopRef.current && y > HIDE_AT) {
          const h = topBarHeightRef.current || 32; // fallback ako merenje nije stiglo

          showTopRef.current = false;
          setShowTop(false);

          // kompenzuj da scrollY ne “padne” nazad (što pravi treptanje)
          skipScrollRef.current = true;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.scrollTo(0, window.scrollY + h);
              skipScrollRef.current = false;
            });
          });

          return;
        }

        // prikaži samo kad korisnik dođe baš na vrh
        if (!showTopRef.current && y <= SHOW_AT) {
          showTopRef.current = true;
          setShowTop(true);
        }
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 999,
        background: "#fff",
        borderBottom: "1px solid #eee",
      }}
    >
      <style>{`
        .mp-top{
          background:#111;
          color:#fff;
          border-bottom:1px solid rgba(255,255,255,.12);
          padding:8px 0;
          font-size:12px;
          font-weight:700;
          letter-spacing:.2px;
        }

        .mp-viewport{
          width:60vw;
          max-width:980px;
          margin:0 auto;
          overflow:hidden;
          white-space:nowrap;
          position:relative;
        }

        .mp-text{
          display:inline-block;
          will-change:transform;
          transform:translateX(0px);
        }

        @media (prefers-reduced-motion: reduce){
          .mp-text{ transform:none !important; }
        }
      `}</style>

      {/* Top bar (samo na vrhu) */}
      {showTop && (
        <div ref={topBarWrapRef}>
          <TopMarquee msg={msg} />
        </div>
      )}

      {/* Main bar */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "18px 16px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Left: logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "#111",
              fontSize: 18,
              letterSpacing: 3,
              fontWeight: 300,
            }}
          >
            MIKROPARFEM
          </Link>
        </div>

        {/* Center: nav */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: "#111",
            justifyContent: "center",
            whiteSpace: "nowrap",
          }}
        >
          <Link href="/o-nama" style={{ textDecoration: "none", color: "#111" }}>
            O NAMA
          </Link>

          <Link href="/shop" style={{ textDecoration: "none", color: "#111" }}>
            SHOP
          </Link>

          <Link href="/blog" style={{ textDecoration: "none", color: "#111" }}>
            BLOG
          </Link>
        </nav>

        {/* Right: icons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 14,
            alignItems: "center",
          }}
        >
          <button
            aria-label="Pretraga"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ⌕
          </button>

          <button
            aria-label="Lista želja"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            ♡
          </button>

          <button
            aria-label="Nalog"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            👤
          </button>

          <button
            id="cart-button"
            aria-label="Korpa"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fff",
              cursor: "pointer",
              position: "relative",
            }}
          >
            👜
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#111",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
              }}
            >
              1
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}