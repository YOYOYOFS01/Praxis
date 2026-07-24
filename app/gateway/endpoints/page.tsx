// Endpoint Configuration Page — server component
// Lists and manages EndpointConfig records.
// Requirements: 16.4

interface EndpointConfig {
  id: string;
  resource: string;
  amountUsdc: string;
  description: string;
  payTo: string;
  asset: string;
  network: string;
  chainId: number;
  nonceTtlSeconds: number;
  isActive: boolean;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

async function getEndpoints(): Promise<EndpointConfig[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const apiKey = process.env.API_SECRET_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  try {
    const res = await fetch(`${baseUrl}/api/gateway/endpoints`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    return res.json() as Promise<EndpointConfig[]>;
  } catch {
    return [];
  }
}

function truncate(s: string, start: number, end = 0): string {
  if (s.length <= start + end + 3) return s;
  return end > 0 ? `${s.slice(0, start)}...${s.slice(-end)}` : `${s.slice(0, start)}...`;
}

const th = {
  padding: "10px 12px",
  textAlign: "left" as const,
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap" as const,
};

const td = {
  padding: "10px 12px",
  fontSize: "12px",
  color: "var(--text-2)",
  borderBottom: "1px solid var(--border-3)",
  verticalAlign: "middle" as const,
};

export default async function EndpointsPage() {
  const endpoints = await getEndpoints();

  return (
    <div style={{ padding: "32px", background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <a href="/gateway" style={{ fontSize: "12px", color: "var(--text-muted)" }}>← Gateway</a>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginTop: "8px" }}>
          Endpoint Configuration
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
          Manage x402-protected API routes and their payment parameters.
        </p>
      </div>

      {/* Table */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "20px",
      }}>
        {endpoints.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No endpoints configured yet.
            <div style={{ marginTop: "8px", fontSize: "12px" }}>
              Use <code style={{ color: "var(--teal)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>POST /api/gateway/endpoints</code> to register one.
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Resource", "Amount", "Description", "Pay To", "Network", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id}>
                  <td style={{ ...td, maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ep.resource}
                  </td>
                  <td style={{ ...td, color: "var(--green)", fontWeight: 600 }}>${ep.amountUsdc}</td>
                  <td style={{ ...td, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-2)" }}>
                    {ep.description}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "11px" }}>
                    {truncate(ep.payTo, 6, 4)}
                  </td>
                  <td style={td}>{ep.network}</td>
                  <td style={td}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: ep.isActive ? "var(--green-fill)" : "var(--red-fill)",
                      color: ep.isActive ? "var(--green)" : "var(--red)",
                    }}>
                      {ep.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontSize: "11px" }}>
                    {new Date(ep.createdAt).toLocaleDateString()}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={actionBtn} title={`PATCH /api/gateway/endpoints/${ep.id}`}>
                        Edit
                      </button>
                      {ep.isActive && (
                        <button style={{ ...actionBtn, color: "var(--red)", borderColor: "var(--red-fill)" }}
                          title={`DELETE /api/gateway/endpoints/${ep.id}`}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* API reference note */}
      <div style={{
        padding: "14px 18px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        fontSize: "12px",
        color: "var(--text-muted)",
        lineHeight: 1.8,
      }}>
        <strong style={{ color: "var(--text-2)" }}>API Reference</strong>
        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {[
            "POST /api/gateway/endpoints — create a new protected endpoint",
            "PATCH /api/gateway/endpoints/[id] — update amountUsdc, payTo, description, isActive",
            "DELETE /api/gateway/endpoints/[id] — deactivate (set isActive: false)",
          ].map((line) => (
            <code key={line} style={{
              background: "var(--surface-2)", padding: "2px 8px",
              borderRadius: "var(--radius-sm)", fontSize: "11px",
              color: "var(--teal)", display: "block",
            }}>
              {line}
            </code>
          ))}
        </div>
        <p style={{ marginTop: "8px", fontSize: "11px" }}>
          All routes require <code style={{ color: "var(--orange)" }}>Authorization: Bearer &lt;key:manage scope&gt;</code>
        </p>
      </div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  padding: "3px 10px",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-2)",
  fontSize: "11px",
  cursor: "pointer",
};
