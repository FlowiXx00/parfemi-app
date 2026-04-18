export default function Loading() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        width: "100%",
        padding: "40px 16px",
        background: "var(--background)",
      }}
    >
      <div
        style={{
          width: "52px",
          height: "52px",
          border: "4px solid var(--border)",
          borderTopColor: "var(--accent)",
          borderRadius: "999px",
          animation: "shopSpinner 0.8s linear infinite",
        }}
      />

      <div
        style={{
          color: "var(--text-muted)",
          fontSize: "15px",
          fontWeight: 600,
        }}
      >
        Učitavanje...
      </div>

      <style>{`
        @keyframes shopSpinner {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}