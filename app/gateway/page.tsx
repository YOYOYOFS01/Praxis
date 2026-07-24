// Gateway Overview — server component
// Fetches live analytics and recent payments from the gateway API.
// Requirements: 16.1

interface Analytics {
  totalRevenueUsdc: string;
  successRate: string;
  avgSettlementTimeMs: number;
  replaysBlocked: number;
  pendingIntentCount: number;
}

interface PaymentRecord {
  id: string;
  nonce: string;
  payerAddress: string;
  resource: string;
  amountUsdc: string;
  settlementMode: string;
  txHash: string | null;
  verifiedAt: string;
}

interface IntentPage {
  total: number;
}

async function apiFetch<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const apiKey = process.env.API_SECRET_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  try {
    const res = await fetch(`${baseUrl}${path}`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

function truncate(s: string | null | undefined, start: number, end = 0): string {
  if (!s) return "—";
  if (s.length <= start + end + 3) return s;
  return end > 0 ? `${s.slice(0, start)}...${s.slice(-end)}` : `${s.slice(0, start)}...`;
}

function formatMs(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column" as const,
  gap: "8px",
};

const th = {
  padding: "10px 12px",
  textAlign: "left" as const,
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--border)",
};

const td = {
  padding: "10px 12px",
  fontSize: "12px",
  color: "var(--text-2)",
  borderBottom: "1px solid var(--border-3)",
};

export default async function GatewayPage() {
  const analytics = await apiFetch<Analytics>("/api/gateway/analytics");
  const payments = await apiFetch<{ data: PaymentRecord[] }>("/api/gateway/payments?limit=10");
  const created = await apiFetch<IntentPage>("/api/gateway/intents?limit=1&status=CREATED");
  const verifying = await apiFetch<IntentPage>("/api/gateway/intents?limit=1&status=VERIFYING");
  const settled = await apiFetch<IntentPage>("/api/gateway/intents?limit=1&status=SETTLED");
  const failed = await apiFetch<IntentPage>("/api/gateway/intents?limit=1&status=FAILED");

  const kpis = [
    { label: "Total Revenue", value: analytics ? `$${analytics.totalRevenueUsdc} USDC` : "—" },
    { label: "Success Rate (24h)", value: analytics ? `${analytics.successRate}%` : "—" },
    { label: "Avg Settlement", value: analytics ? formatMs(analytics.avgSettlementTimeMs) : "—" },
    { label: "Replay Attacks (24h)", value: analytics ? String(analytics.replaysBlocked) : "—" },
    { label: "Pending Intents", value: analytics ? String(analytics.pendingIntentCount) : "—" },
  ];

  const recentPayments = payments?.data ?? [];

  return (
    <div style={{ padding: "32px", background: "var(--bg)", minHeight: "100vh", fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Gateway Overview
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
          Live x402 payment metrics — rolling 24h window
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "32px" }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={card}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>{kpi.label}</span>
            <span style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* PaymentIntent Funnel */}
      <div style={{ ...card, flexDirection: "row", gap: "0", marginBottom: "32px", padding: "16px 24px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginRight: "20px" }}>
          INTENT FUNNEL
        </span>
        {[
          { label: "CREATED", count: created?.total ?? 0, color: "var(--text-2)" },
          { label: "VERIFYING", count: verifying?.total ?? 0, color: "var(--orange)" },
          { label: "SETTLED", count: settled?.total ?? 0, color: "var(--green)" },
          { label: "FAILED", count: failed?.total ?? 0, color: "var(--red)" },
        ].map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {i > 0 && <span style={{ color: "var(--border-2)", margin: "0 8px" }}>→</span>}
            <span style={{ fontSize: "12px", color: s.color, fontWeight: 600 }}>
              {s.label}
            </span>
            <span style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "1px 8px",
              fontSize: "12px",
              fontWeight: 700,
              color: s.color,
            }}>
              {s.count}
            </span>
          </div>
        ))}
      </div>

      {/* Recent Payments */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>Recent Payments</span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>last 10</span>
        </div>
        {recentPayments.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No payments yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Nonce", "Payer", "Resource", "Amount", "Mode", "Tx", "Verified At"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((p) => (
                <tr key={p.id}>
                  <td style={td}>{truncate(p.nonce, 8)}</td>
                  <td style={td}>{truncate(p.payerAddress, 6, 4)}</td>
                  <td style={{ ...td, maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.resource}
                  </td>
                  <td style={{ ...td, color: "var(--green)" }}>${p.amountUsdc}</td>
                  <td style={td}>{p.settlementMode}</td>
                  <td style={td}>
                    {p.txHash ? (
                      <a href={`https://sepolia.basescan.org/tx/${p.txHash}`} target="_blank" rel="noreferrer"
                        style={{ color: "var(--teal)", fontSize: "11px" }}>
                        {truncate(p.txHash, 8)}
                      </a>
                    ) : "—"}
                  </td>
                  <td style={td}>{new Date(p.verifiedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Navigation links */}
      <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
        {[
          { href: "/gateway/payments", label: "→ Payment History" },
          { href: "/gateway/intents", label: "→ Intent Lifecycle" },
          { href: "/gateway/endpoints", label: "→ Endpoint Config" },
          { href: "/gateway/webhooks", label: "→ Webhook Logs" },
        ].map((link) => (
          <a key={link.href} href={link.href} style={{
            padding: "8px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "12px",
            color: "var(--text-2)",
            fontWeight: 500,
          }}>
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
