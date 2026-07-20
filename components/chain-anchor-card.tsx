"use client";

import { Card, Row } from "./vendor-quote-card";

interface Props {
  anchor: Record<string, unknown>;
}

export function ChainAnchorCard({ anchor }: Props) {
  const anchorTx = String(anchor.anchorTxHash ?? "");
  const isMock   = anchorTx.startsWith("0xmock");
  const basescanUrl = isMock
    ? null
    : `https://sepolia.basescan.org/tx/${anchorTx}`;

  return (
    <Card title="Chain Anchor — Base Sepolia" accentColor="var(--purple)" accentFill="var(--purple-fill)" icon="⬡">
      <Row label="Network"     value={String(anchor.network ?? "—")} />
      <Row label="Chain ID"    value={String(anchor.chainId ?? "—")} />
      <Row label="Registry"    value={truncate(String(anchor.registryAddress ?? "—"))} mono />
      <Row label="Proof Hash"  value={truncate(String(anchor.proofHash ?? "—"))} mono />
      <Row label="Anchor Tx"   value={truncate(anchorTx)} mono />
      <Row label="Anchored at" value={anchor.anchoredAt ? new Date(anchor.anchoredAt as string).toLocaleString() : "—"} />

      {isMock && (
        <div style={{
          marginTop: "4px",
          padding: "8px 12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          fontSize: "11px",
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}>
          Mock anchor — set <code style={{ fontFamily: "monospace", color: "var(--text-2)" }}>CHAIN_MODE=base-sepolia</code> for a live BaseScan link
        </div>
      )}

      {basescanUrl && (
        <a
          href={basescanUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "6px",
            padding: "8px 14px",
            background: "var(--purple-fill)",
            border: "1px solid rgba(144,112,208,0.3)",
            borderRadius: "var(--radius-md)",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--purple)",
            transition: "background 0.15s, border-color 0.15s",
            alignSelf: "flex-start",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(144,112,208,0.2)";
            e.currentTarget.style.borderColor = "rgba(144,112,208,0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--purple-fill)";
            e.currentTarget.style.borderColor = "rgba(144,112,208,0.3)";
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
