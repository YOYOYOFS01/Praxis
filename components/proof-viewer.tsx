"use client";

import { Card, Row } from "./vendor-quote-card";

interface Props {
  proof: Record<string, unknown>;
  proofHash: string;
}

export function ProofViewer({ proof, proofHash }: Props) {
  return (
    <Card title="Proof of Reasoning" borderColor="var(--orange)">
      {proof.agentSummary != null && (
        <div style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          padding: "10px 12px",
          fontSize: "13px",
          color: "var(--text)",
          lineHeight: 1.6,
          marginBottom: "8px",
        }}>
          {String(proof.agentSummary)}
        </div>
      )}
      <Row label="Generated at" value={proof.generatedAt ? new Date(proof.generatedAt as string).toLocaleString() : "—"} />
      <Row label="Proof Hash"   value={proofHash ?? "—"} mono />
      <div style={{ marginTop: "8px" }}>
        <details>
          <summary style={{ fontSize: "11px", color: "var(--text-muted)", cursor: "pointer" }}>
            Raw proof JSON
          </summary>
          <pre style={{
            marginTop: "8px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "10px",
            fontSize: "11px",
            color: "#999",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {JSON.stringify(proof, null, 2)}
          </pre>
        </details>
      </div>
    </Card>
  );
}
