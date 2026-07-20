"use client";

export function DemoModeBadge() {
  const paymentMode = process.env.NEXT_PUBLIC_PAYMENT_MODE ?? "mock";
  const chainMode   = process.env.NEXT_PUBLIC_CHAIN_MODE   ?? "mock";

  const label = paymentMode === "mock" ? "DEMO" : paymentMode.toUpperCase();
  const color = paymentMode === "mock"
    ? "var(--text-muted)"
    : paymentMode === "x402"
    ? "var(--teal)"
    : "var(--yellow)";

  return (
    <span style={{
      fontSize: "0.65rem",
      fontWeight: 700,
      letterSpacing: "0.08em",
      color,
      border: `1px solid ${color}`,
      borderRadius: "4px",
      padding: "2px 6px",
      textTransform: "uppercase",
    }}>
      {label} / {chainMode}
    </span>
  );
}
