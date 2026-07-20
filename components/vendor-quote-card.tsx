"use client";

interface Props {
  quote: Record<string, unknown>;
}

export function VendorQuoteCard({ quote }: Props) {
  return (
    <Card title="Vendor Quote" accentColor="var(--orange)" accentFill="var(--orange-fill)" icon="◈">
      <Row label="Vendor"      value={String(quote.vendorName ?? "—")} />
      <Row label="Item"        value={String(quote.itemDescription ?? "—")} />
      <Row label="Quantity"    value={String(quote.quantity ?? "—")} />
      <Divider />
      <Row label="Unit Price"  value={`$${Number(quote.unitPriceUsd ?? 0).toLocaleString()}`} />
      <Row label="Total"       value={`$${Number(quote.totalAmountUsd ?? 0).toLocaleString()} USDC`} bold highlight="var(--orange)" />
      <Divider />
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
  if (s.length > 22) return `${s.slice(0, 10)}…${s.slice(-6)}`;
  return s;
}

// ── Shared primitives ──────────────────────────────────────────────────────

export function Card({
  title, accentColor, accentFill, icon, children,
}: {
  title: string;
  accentColor: string;
  accentFill: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      boxShadow: "var(--shadow-sm)",
    }}>
      {/* Card header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "13px 18px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,0.015)",
      }}>
        {icon && (
          <span style={{
            width: "22px", height: "22px",
            background: accentFill,
            border: `1px solid ${accentColor}`,
            borderRadius: "var(--radius)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", color: accentColor,
            flexShrink: 0,
          }}>
            {icon}
          </span>
        )}
        <p style={{
          fontSize: "11px",
          fontWeight: 700,
          color: accentColor,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
        }}>
          {title}
        </p>
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {children}
      </div>
    </div>
  );
}

export function Divider() {
  return (
    <div style={{
      height: "1px",
      background: "var(--border)",
      margin: "4px 0",
    }} />
  );
}

export function Row({
  label, value, bold, mono, highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  highlight?: string;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      gap: "16px",
      alignItems: "baseline",
    }}>
      <span style={{
        fontSize: "12px",
        color: "var(--text-muted)",
        flexShrink: 0,
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: "12.5px",
        color: highlight ?? (bold ? "var(--text)" : "var(--text-2)"),
        fontWeight: bold ? 700 : 450,
        fontFamily: mono ? "'Courier New', monospace" : "inherit",
        textAlign: "right",
        wordBreak: "break-all",
        letterSpacing: mono ? "0.02em" : "inherit",
      }}>
        {value}
      </span>
    </div>
  );
}
