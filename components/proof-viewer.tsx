"use client";

import { useState } from "react";
import { Card, Row } from "./vendor-quote-card";

interface Props {
  proof: Record<string, unknown>;
  proofHash: string;
}

export function ProofViewer({ proof, proofHash }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
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

      {/* Raw JSON toggle */}
      <div style={{ marginTop: "4px" }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "5px 10px",
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

        {expanded && (
          <pre style={{
            marginTop: "8px",
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
      </div>
    </Card>
  );
}
