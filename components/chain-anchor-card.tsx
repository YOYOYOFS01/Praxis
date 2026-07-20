"use client";

import { Card, Row } from "./vendor-quote-card";

interface Props {
  anchor: Record<string, unknown>;
}

export function ChainAnchorCard({ anchor }: Props) {
  const anchorTx = String(anchor.anchorTxHash ?? "");
  const isMock = anchorTx.startsWith("0xmock");
  const basescanUrl = isMock
    ? null
    : `https://sepolia.basescan.org/tx/${anchorTx}`;

  return (
    <Card title="Chain Anchor — Base Sepolia" borderColor="var(--purple)">
      <Row label="Network"     value={String(anchor.network ?? "—")} />
      <Row label="Chain ID"    value={String(anchor.chainId ?? "—")} />
      <Row label="Registry"    value={truncate(String(anchor.registryAddress ?? "—"))} mono />
      <Row label="Proof Hash"  value={truncate(String(anchor.proofHash ?? "—"))} mono />
      <Row label="Anchor Tx"   value={truncate(anchorTx)} mono />
      <Row label="Anchored at" value={anchor.anchoredAt ? new Date(anchor.anchoredAt as string).toLocaleString() : "—"} />

      {isMock && (
        <div style={{
          marginTop: "8px",
          padding: "6px 10px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}>
          Mock anchor — set CHAIN_MODE=base-sepolia for live BaseScan link
        </div>
      )}

      {basescanUrl && (
        <a
          href={basescanUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            marginTop: "10px",
            padding: "6px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--purple)",
            borderRadius: "4px",
            fontSize: "12px",
            color: "var(--purple)",
            fontWeight: 600,
          }}
        >
          View on BaseScan ↗
        </a>
      )}
    </Card>
  );
}

function truncate(s: string) {
  if (s.length > 24) return `${s.slice(0, 12)}…${s.slice(-8)}`;
  return s;
}
