"use client";

import { useEffect } from "react";

/**
 * Last line of defense: an error in the root layout itself. It replaces the whole document,
 * so there are no global styles; everything is inline here, in the site's dark theme.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="sr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 16,
          background: "#0b0d11",
          color: "#f3efe7",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <title>Greška | Atelier Dekant</title>
        <main
          style={{
            width: "min(560px, 100%)",
            padding: "48px 28px",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "radial-gradient(420px 220px at 50% 0%, rgba(210,176,112,0.16), transparent 72%), #15181d",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 0.9, color: "#d2b070" }}>500</div>
          <p style={{ margin: "18px 0 6px", color: "#d2b070", fontSize: 11, fontWeight: 800, letterSpacing: "0.2em" }}>
            ATELIER DEKANT
          </p>
          <h1 style={{ margin: 0, fontSize: 28 }}>Sajt trenutno ne radi</h1>
          <p style={{ margin: "12px auto 24px", maxWidth: 420, color: "#a7a39b", lineHeight: 1.6 }}>
            Desila se greška kod nas. Pokušaj ponovo za par sekundi — korpa ostaje sačuvana.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 46,
              padding: "0 24px",
              border: 0,
              borderRadius: 999,
              background: "#d2b070",
              color: "#17140e",
              font: "inherit",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Pokušaj ponovo
          </button>
        </main>
      </body>
    </html>
  );
}
