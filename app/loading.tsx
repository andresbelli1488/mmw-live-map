export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#09090b",
        color: "#f4f4f5",
        fontFamily: "var(--font-outfit), sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            margin: "0 auto 16px",
            borderRadius: "50%",
            border: "3px solid rgba(216,184,107,0.25)",
            borderTopColor: "#d8b86b",
            animation: "spin 1s linear infinite",
          }}
        />
        <div style={{ letterSpacing: 2, textTransform: "uppercase", color: "#d8b86b", fontSize: 12 }}>Loading MMW Live Map</div>
      </div>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </main>
  );
}
