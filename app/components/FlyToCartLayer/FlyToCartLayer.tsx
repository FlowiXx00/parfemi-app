"use client";

import { useEffect, useState } from "react";

type FlyEventDetail = { x: number; y: number; img?: string };
type FlyItem = { id: string; x: number; y: number; dx: number; dy: number; img?: string };

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function FlyParticle({ item, onDone }: { item: FlyItem; onDone: (id: string) => void }) {
  const [go, setGo] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      onTransitionEnd={() => onDone(item.id)}
      style={{
        position: "fixed",
        left: item.x,
        top: item.y,
        width: 44,
        height: 44,
        borderRadius: 12,
        pointerEvents: "none",
        zIndex: 9999,
        background: item.img ? `url(${item.img}) center/contain no-repeat` : "#111",
        boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
        transform: go ? `translate(${item.dx}px, ${item.dy}px) scale(0.45)` : "translate(0,0) scale(1)",
        opacity: go ? 0.15 : 0.95,
        transition: "transform 1100ms cubic-bezier(0.16, 1, 0.3, 1), opacity 1100ms ease",
      }}
    />
  );
}

export default function FlyToCartLayer() {
  const [items, setItems] = useState<FlyItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FlyEventDetail>).detail;
      const cartEl = document.getElementById("cart-button");
      if (!cartEl) return;

      const end = cartEl.getBoundingClientRect();
      const endX = end.left + end.width / 2;
      const endY = end.top + end.height / 2;

      const id = uid();
      const startX = detail.x;
      const startY = detail.y;

      setItems((prev) => [
        ...prev,
        {
          id,
          x: startX,
          y: startY,
          dx: endX - startX,
          dy: endY - startY,
          img: detail.img,
        },
      ]);

      // bounce na korpi
      cartEl.classList.add("cart-bounce");
      window.setTimeout(() => cartEl.classList.remove("cart-bounce"), 700);
    };

    window.addEventListener("fly-to-cart", handler as any);
    return () => window.removeEventListener("fly-to-cart", handler as any);
  }, []);

  return (
    <>
      <style>{`
        .cart-bounce { animation: cartBounce 450ms ease; }
        @keyframes cartBounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998 }}>
        {items.map((it) => (
          <FlyParticle
            key={it.id}
            item={it}
            onDone={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </>
  );
}