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
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid rgba(212,168,64,0.3)",
        borderRadius: "var(--radius-xl)",
        padding: "28px",
        maxWidth: "460px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px",
            background: "var(--yellow-fill)",
            border: "1px solid rgba(212,168,64,0.3)",
            borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
            flexShrink: 0,
          }}>
            ⚠
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--yellow)",
              letterSpacing: "-0.01em",
            }}>
              Human Approval Required
            </h2>
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.55 }}>
              This payment exceeds the auto-approval threshold and requires your authorisation.
            </p>
          </div>
        </div>

        {/* Intent details */}
        {intent && (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <InfoRow label="Vendor" value={String(intent.vendorName ?? "—")} />
            <InfoRow label="Item"   value={String(intent.itemDescription ?? "—")} />
            <InfoRow label="Qty"    value={String(intent.quantity ?? "—")} />
            <div style={{ height: "1px", background: "var(--border)", margin: "2px 0" }} />
            <InfoRow
              label="Total"
              value={`$${Number(intent.totalAmountUsd ?? 0).toLocaleString()} USDC`}
              bold
            />
          </div>
        )}

        {/* Agent summary */}
        {proof?.agentSummary != null && (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "11px 14px",
            fontSize: "12px",
            color: "var(--text-2)",
            lineHeight: 1.65,
          }}>
            {String(proof.agentSummary)}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              background: "var(--green)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "11px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "opacity 0.15s, transform 0.1s",
              letterSpacing: "-0.01em",
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={(e)   => { e.currentTarget.style.transform = "scale(1)"; }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            ✓ Approve Payment
          </button>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              background: "var(--red-fill)",
              color: "var(--red)",
              border: "1px solid rgba(204,85,85,0.3)",
              borderRadius: "var(--radius-md)",
              padding: "11px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "background 0.15s, border-color 0.15s, transform 0.1s",
              letterSpacing: "-0.01em",
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={(e)   => { e.currentTarget.style.transform = "scale(1)"; }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(204,85,85,0.18)";
              e.currentTarget.style.borderColor = "rgba(204,85,85,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--red-fill)";
              e.currentTarget.style.borderColor = "rgba(204,85,85,0.3)";
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
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "baseline" }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: "13px",
        fontWeight: bold ? 700 : 450,
        color: bold ? "var(--text)" : "var(--text-2)",
        textAlign: "right",
      }}>
        {value}
      </span>
    </div>
  );
}
