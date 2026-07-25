"use client";

import { useState } from "react";
import { Card, Row } from "./vendor-quote-card";
import { ProofDrawer } from "./proof-drawer";

interface Props {
  proof: Record<string, unknown>;
  proofHash: string;
}

export function ProofViewer({ proof, proofHash }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Card title="Proof of Reasoning" accentColor="var(--orange)" accentFill="var(--orange-fill)" icon="◉">
        {proof.agentSummary != null && (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            fontSize: "13px",
            color: "var(--text-2)",
            lineHeight: 1.65,
          }}>
            {String(proof.agentSummary)}
          </div>
        )}

        <Row
          label="Generated at"
          value={proof.generatedAt ? new Date(proof.generatedAt as string).toLocaleString() : "—"}
        />
        <Row label="Proof Hash" value={proofHash ?? "—"} mono />

        <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
          {/* Open Cryptographic Drawer button */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: "linear-gradient(135deg, rgba(0, 245, 212, 0.2), rgba(0, 245, 212, 0.05))",
              border: "1px solid var(--teal, #00f5d4)",
              borderRadius: "var(--radius, 8px)",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--teal, #00f5d4)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              boxShadow: "0 0 12px rgba(0, 245, 212, 0.15)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.background = "rgba(0, 245, 212, 0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "linear-gradient(135deg, rgba(0, 245, 212, 0.2), rgba(0, 245, 212, 0.05))"; }}
          >
            <span>◉</span> Open Cryptographic Proof Drawer ↗
          </button>

          {/* Raw JSON toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "8px 12px",
              fontSize: "11px",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              e.currentTarget.style.color = "var(--text-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <span style={{
              display: "inline-block",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}>▶</span>
            Raw proof JSON
          </button>
        </div>

        {expanded && (
          <pre style={{
            marginTop: "12px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            fontSize: "11px",
            color: "var(--text-muted)",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            lineHeight: 1.6,
            fontFamily: "'Courier New', monospace",
          }}>
            {JSON.stringify(proof, null, 2)}
          </pre>
        )}
      </Card>

      <ProofDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        proof={proof}
        proofHash={proofHash}
        budget={proof.budgetDecision as Record<string, unknown> | undefined}
        policy={proof.policyDecision as Record<string, unknown> | undefined}
      />
    </>
  );
}
