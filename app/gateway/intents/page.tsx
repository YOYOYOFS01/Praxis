// PaymentIntent Lifecycle View — server component
// Paginated list of PaymentIntent rows with status filtering.
// Requirements: 16.3

interface PaymentIntent {
  id: string;
  nonce: string;
  correlationId: string | null;
  resource: string;
  amountUsdc: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
  verifyingAt: string | null;
  settledAt: string | null;
  failedAt: string | null;
}

interface IntentsResponse {
  data: PaymentIntent[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function getIntents(params: Record<string, string>): Promise<IntentsResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const apiKey = process.env.API_SECRET_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${baseUrl}/api/gateway/intents?${qs}`, { headers, cache: "no-store" });
    if (!res.ok) return { data: [], total: 0, page: 1, limit: 20, pages: 0 };
    return res.json() as Promise<IntentsResponse>;
  } catch {
    return { data: [], total: 0, page: 1, limit: 20, pages: 0 };
  }
}

const STATUS_COLORS: Record<string, string> = {
  SETTLED: "var(--green)",
  FAILED: "var(--red)",
  VERIFYING: "var(--orange)",
  CREATED: "var(--text-muted)",
};

const STATUS_BG: Record<string, string> = {
  SETTLED: "var(--green-fill)",
  FAILED: "var(--red-fill)",
  VERIFYING: "var(--orange-fill)",
  CREATED: "rgba(255,255,255,0.05)",
};

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString();
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
  verticalAlign: "top" as const,
};

const STATUSES = ["CREATED", "VERIFYING", "SETTLED", "FAILED"] as const;

export default async function IntentsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const page = searchParams.page ?? "1";
  const status = searchParams.status ?? "";

  const params: Record<string, string> = { page, limit: "20" };
  if (status) params.status = status;

  const result = await getIntents(params);
  const pageNum = result.page;
  const start = (pageNum - 1) * result.limit + 1;
  const end = Math.min(pageNum * result.limit, result.total);

  function pageUrl(p: number) {
    const ps = new URLSearchParams({ ...params, page: String(p) });
    return `/gateway/intents?${ps.toString()}`;
  }

  function statusUrl(s: string) {
    return s ? `/gateway/intents?status=${s}` : "/gateway/intents";
  }

  return (
    <div style={{ padding: "32px", background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <a href="/gateway" style={{ fontSize: "12px", color: "var(--text-muted)" }}>← Gateway</a>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginTop: "8px" }}>
          PaymentIntent Lifecycle
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
          Track every payment attempt through its lifecycle states
        </p>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {["", ...STATUSES].map((s) => {
          const active = status === s;
          return (
            <a
              key={s || "all"}
              href={statusUrl(s)}
              style={{
                padding: "5px 14px",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
                fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? (STATUS_COLORS[s] ?? "var(--border-2)") : "var(--border)"}`,
                background: active ? (STATUS_BG[s] ?? "var(--surface-2)") : "var(--surface)",
                color: active ? (STATUS_COLORS[s] ?? "var(--text)") : "var(--text-2)",
                textDecoration: "none",
              }}
            >
              {s || "ALL"}
            </a>
          );
        })}
      </div>

      {/* Count */}
      {result.total > 0 && (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Showing {start}–{end} of {result.total} intents
        </div>
      )}

      {/* Table */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        {result.data.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No intents found{status ? ` with status "${status}"` : ""}.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Correlation ID", "Resource", "Amount", "Status", "Created", "Verifying", "Settled / Failed", "Failure Reason"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((intent) => (
                <tr key={intent.id}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "11px" }}>
                    {truncate(intent.correlationId, 12)}
                  </td>
                  <td style={{ ...td, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {intent.resource}
                  </td>
                  <td style={{ ...td, color: "var(--green)", fontWeight: 600 }}>${intent.amountUsdc}</td>
                  <td style={td}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: STATUS_BG[intent.status] ?? "rgba(255,255,255,0.05)",
                      color: STATUS_COLORS[intent.status] ?? "var(--text-2)",
                    }}>
                      {intent.status}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontSize: "11px" }}>{fmtDate(intent.createdAt)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontSize: "11px" }}>{fmtDate(intent.verifyingAt)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontSize: "11px" }}>
                    {fmtDate(intent.settledAt ?? intent.failedAt)}
                  </td>
                  <td style={{ ...td, fontSize: "11px", color: "var(--red)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {intent.failureReason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {result.pages > 1 && (
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", alignItems: "center" }}>
          {pageNum > 1 && (
            <a href={pageUrl(pageNum - 1)} style={paginationBtn}>← Prev</a>
          )}
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Page {pageNum} of {result.pages}
          </span>
          {pageNum < result.pages && (
            <a href={pageUrl(pageNum + 1)} style={paginationBtn}>Next →</a>
          )}
        </div>
      )}
    </div>
  );
}

const paginationBtn: React.CSSProperties = {
  padding: "6px 14px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-2)",
  fontSize: "12px",
  fontWeight: 500,
  textDecoration: "none",
};
