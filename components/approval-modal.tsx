"use client";

interface Props {
  run: Record<string, unknown>;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalModal({ run, onApprove, onReject }: Props) {
  const intent = run.intentJson as Record<string, unknown> | undefined;
  const proof  = run.proofJson  as Record<string, unknown> | undefined;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--yellow)",
        borderRadius: "10px",
        padding: "28px 32px",
        maxWidth: "480px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.2rem" }}>⚠</span>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--yellow)" }}>
            Human Approval Required
          </h2>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          This payment exceeds the auto-approval threshold and requires your authorisation.
        </p>

        {intent && (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}>
            <InfoRow label="Vendor"  value={String(intent.vendorName ?? "—")} />
            <InfoRow label="Item"    value={String(intent.itemDescription ?? "—")} />
            <InfoRow label="Qty"     value={String(intent.quantity ?? "—")} />
            <InfoRow
              label="Total"
              value={`$${Number(intent.totalAmountUsd ?? 0).toLocaleString()} USDC`}
              bold
            />
          </div>
        )}

        {proof?.agentSummary != null && (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "10px 12px",
            fontSize: "12px",
            color: "#aaa",
            lineHeight: 1.6,
          }}>
            {String(proof.agentSummary)}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              background: "var(--green)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "10px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✓ Approve Payment
          </button>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              background: "transparent",
              color: "var(--red)",
              border: "1px solid var(--red)",
              borderRadius: "6px",
              padding: "10px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✗ Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: bold ? 700 : 400, color: bold ? "#fff" : "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}
