"use client";

import { Card, Row } from "./vendor-quote-card";

interface Props {
  receipt: Record<string, unknown>;
}

const MODE_COLORS: Record<string, string> = {
  mock:   "var(--text-muted)",
  hybrid: "var(--yellow)",
  x402:   "var(--teal)",
};

export function PaymentCard({ receipt }: Props) {
  const mode = String(receipt.mode ?? "mock");

  return (
    <Card title="Payment Receipt" borderColor="var(--pink)">
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: MODE_COLORS[mode] ?? "var(--text-muted)",
          background: "var(--surface-2)",
          border: `1px solid ${MODE_COLORS[mode] ?? "var(--border)"}`,
          borderRadius: "4px",
          padding: "2px 7px",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          {mode}
        </span>
        <span style={{ fontSize: "12px", color: "var(--green)", fontWeight: 600 }}>✓ Settled</span>
      </div>

      <Row label="Amount"     value={`$${Number(receipt.amountUsdc ?? 0).toLocaleString()} USDC`} bold />
      <Row label="Pay To"     value={truncate(String(receipt.payeeAddress ?? "—"))} mono />
      <Row label="Settled at" value={receipt.settledAt ? new Date(receipt.settledAt as string).toLocaleString() : "—"} />
      {receipt.txHash != null && <Row label="Tx Hash" value={truncate(String(receipt.txHash))} mono />}
    </Card>
  );
}

function truncate(s: string) {
  if (s.length > 24) return `${s.slice(0, 12)}…${s.slice(-8)}`;
  return s;
}
