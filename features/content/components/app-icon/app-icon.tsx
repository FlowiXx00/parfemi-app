/**
 * App icon (home screen, browser tab, PWA): gold "AD" monogram on the dark stage color, drawn with
 * next/og. The monogram stays inside the middle 70%, so Android's round/"maskable" crop never cuts it.
 */
const GOLD = "#d2b070";
const BACKGROUND = "#0b0d11";

export function AppIconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(${Math.round(size * 0.8)}px ${Math.round(size * 0.8)}px at 70% 20%, rgba(210,176,112,0.25), transparent 70%), ${BACKGROUND}`,
      }}
    >
      <div
        style={{
          width: "62%",
          height: "62%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `${Math.max(2, Math.round(size * 0.018))}px solid ${GOLD}`,
          borderRadius: "50%",
          color: GOLD,
          fontSize: Math.round(size * 0.26),
          fontWeight: 700,
          letterSpacing: Math.round(size * 0.01),
        }}
      >
        AD
      </div>
    </div>
  );
}
