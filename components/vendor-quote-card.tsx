"use client";

interface Props {
  quote: Record<string, unknown>;
}

export function VendorQuoteCard({ quote }: Props) {
  return (
    <Card title="Vendor Quote" borderColor="var(--orange)">
      <Row label="Vendor"      value={String(quote.vendorName ?? "—")} />
      <Row label="Item"        value={String(quote.itemDescription ?? "—")} />
      <Row label="Quantity"    value={String(quote.quantity ?? "—")} />
      <Row label="Unit Price"  value={`$${Number(quote.unitPriceUsd ?? 0).toLocaleString()}`} />
      <Row label="Total"       value={`$${Number(quote.totalAmountUsd ?? 0).toLocaleString()} USDC`} bold />
      <Row label="Quote ID"    value={String(quote.quoteId ?? "—")} mono />
      <Row label="Valid Until" value={fmtDate(quote.validUntil as string)} />
      <Row label="Pay To"      value={truncate(String(quote.paymentAddress ?? "—"))} mono />
    </Card>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function truncate(s: string) {
  if (s.length > 20) return `${s.slice(0, 10)}…${s.slice(-6)}`;
  return s;
}

// ── Shared primitives ──────────────────────────────────────────────────────

export function Card({
  title, borderColor, children,
}: {
  title: string; borderColor: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid var(--border)`,
      borderTop: `2px solid ${borderColor}`,
      borderRadius: "6px",
      padding: "16px 20px",
    }}>
      <p style={{
        fontSize: "0.72rem", color: borderColor,
        textTransform: "uppercase", letterSpacing: "0.08em",
        fontWeight: 600, marginBottom: "12px",
      }}>
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {children}
      </div>
    </div>
  );
}

export function Row({
  label, value, bold, mono,
}: {
  label: string; value: string; bold?: boolean; mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "baseline" }}>
      <span style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: "13px",
        color: bold ? "#fff" : "var(--text)",
        fontWeight: bold ? 600 : 400,
        fontFamily: mono ? "monospace" : "inherit",
        textAlign: "right",
        wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}
