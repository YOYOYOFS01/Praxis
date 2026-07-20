"use client";

import { Card, Row } from "./vendor-quote-card";

interface Props {
  receipt: Record<string, unknown>;
}

const MODE_META: Record<string, { color: string; fill: string; border: string }> = {
  mock:   { color: "var(--text-2)",  fill: "rgba(255,255,255,0.04)", border: "var(--border-2)" },
  hybrid: { color: "var(--yellow)",  fill: "var(--yellow-fill)",     border: "rgba(212,168,64,0.25)" },
  x402:   { color: "var(--teal)",    fill: "var(--teal-fill)",       border: "rgba(58,172,172,0.25)" },
};

export function PaymentCard({ receipt }: Props) {
  const mode = String(receipt.mode ?? "mock");
  const meta = MODE_META[mode] ?? MODE_META.mock;

  return (
    <Card title="Payment Receipt" accentColor="var(--pink)" accentFill="var(--pink-fill)" icon="◈">
      {/* Mode + status row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{
          fontSize: "10px",
          fontWeight: 700,
          color: meta.color,
          background: meta.fill,
          border: `1px solid ${meta.border}`,
          borderRadius: "var(--radius)",
          padding: "2px 8px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontFamily: "monospace",
        }}>
          {mode}
        </span>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--green)",
        }}>
          <span style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: "var(--green)", display: "inline-block",
          }} />
          Settled
        </span>
      </div>

      <Row label="Amount"     value={`$${Number(receipt.amountUsdc ?? 0).toLocaleString()} USDC`} bold highlight="var(--pink)" />
      <Row label="Pay To"     value={truncate(String(receipt.payeeAddress ?? "—"))} mono />
      <Row label="Settled at" value={receipt.settledAt ? new Date(receipt.settledAt as string).toLocaleString() : "—"} />
      {receipt.txHash != null && (
        <Row label="Tx Hash" value={truncate(String(receipt.txHash))} mono />
      )}
    </Card>
  );
}

function truncate(s: string) {
  if (s.length > 24) return `${s.slice(0, 12)}…${s.slice(-8)}`;
  return s;
}
