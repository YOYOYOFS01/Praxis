"use client";

export function DemoModeBadge() {
  const paymentMode = process.env.NEXT_PUBLIC_PAYMENT_MODE ?? "mock";
  const chainMode   = process.env.NEXT_PUBLIC_CHAIN_MODE   ?? "mock";

  const isDemo = paymentMode === "mock";
  const color  = isDemo ? "var(--text-muted)"
    : paymentMode === "x402" ? "var(--teal)"
    : "var(--yellow)";
  const fill   = isDemo ? "rgba(255,255,255,0.04)"
    : paymentMode === "x402" ? "var(--teal-fill)"
    : "var(--yellow-fill)";

  const label = isDemo ? "DEMO" : paymentMode.toUpperCase();

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.12em",
      color,
      background: fill,
      border: `1px solid ${color}`,
      borderRadius: "var(--radius)",
      padding: "2px 7px",
      textTransform: "uppercase",
      fontFamily: "monospace",
    }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: color,
        display: "inline-block",
        flexShrink: 0,
      }} />
      {label} / {chainMode}
    </span>
  );
}
