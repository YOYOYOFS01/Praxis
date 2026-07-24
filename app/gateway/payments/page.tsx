// Payment History — server component
// Paginated list of PaymentRecord rows with filtering.
// Requirements: 16.2

interface PaymentRecord {
  id: string;
  nonce: string;
  payerAddress: string;
  resource: string;
  amountUsdc: string;
  settlementMode: string;
  txHash: string | null;
  verifiedAt: string;
  network: string;
}

interface PaymentsResponse {
  data: PaymentRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function getPayments(params: Record<string, string>): Promise<PaymentsResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const apiKey = process.env.API_SECRET_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${baseUrl}/api/gateway/payments?${qs}`, { headers, cache: "no-store" });
    if (!res.ok) return { data: [], total: 0, page: 1, limit: 20, pages: 0 };
    return res.json() as Promise<PaymentsResponse>;
  } catch {
    return { data: [], total: 0, page: 1, limit: 20, pages: 0 };
  }
}

function truncate(s: string | null | undefined, start: number, end = 0): string {
  if (!s) return "—";
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
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    limit?: string;
    resource?: string;
    payerAddress?: string;
    from?: string;
    to?: string;
  };
}) {
  const page = searchParams.page ?? "1";
  const limit = searchParams.limit ?? "20";

  const params: Record<string, string> = { page, limit };
  if (searchParams.resource) params.resource = searchParams.resource;
  if (searchParams.payerAddress) params.payerAddress = searchParams.payerAddress;
  if (searchParams.from) params.from = searchParams.from;
  if (searchParams.to) params.to = searchParams.to;

  const result = await getPayments(params);
  const pageNum = result.page;
  const start = (pageNum - 1) * result.limit + 1;
  const end = Math.min(pageNum * result.limit, result.total);

  function pageUrl(p: number) {
    const ps = new URLSearchParams({ ...params, page: String(p) });
    return `/gateway/payments?${ps.toString()}`;
  }

  return (
    <div style={{ padding: "32px", background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <a href="/gateway" style={{ fontSize: "12px", color: "var(--text-muted)" }}>← Gateway</a>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginTop: "8px" }}>
          Payment History
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
          All verified x402 payments
        </p>
      </div>

      {/* Filter form */}
      <form method="GET" style={{
        display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px",
        padding: "16px 20px",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      }}>
        <input
          name="resource"
          defaultValue={searchParams.resource ?? ""}
          placeholder="Filter by resource URL"
          style={inputStyle}
        />
        <input
          name="payerAddress"
          defaultValue={searchParams.payerAddress ?? ""}
          placeholder="Filter by payer address"
          style={inputStyle}
        />
        <input
          name="from"
          type="date"
          defaultValue={searchParams.from ?? ""}
          style={inputStyle}
        />
        <input
          name="to"
          type="date"
          defaultValue={searchParams.to ?? ""}
          style={inputStyle}
        />
        <button type="submit" style={btnStyle}>Filter</button>
        <a href="/gateway/payments" style={{ ...btnStyle, display: "inline-block", textDecoration: "none", lineHeight: "32px" }}>
          Reset
        </a>
      </form>

      {/* Count */}
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        {result.total === 0
          ? "No payments found."
          : `Showing ${start}–${end} of ${result.total} payments`}
      </div>

      {/* Table */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        {result.data.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No payments match the current filters.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Nonce", "Payer", "Resource", "Amount", "Mode", "Tx Hash", "Verified At"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((p) => (
                <tr key={p.id} style={{ transition: "background 0.1s" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "11px" }}>{truncate(p.nonce, 8)}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "11px" }}>{truncate(p.payerAddress, 6, 4)}</td>
                  <td style={{ ...td, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.resource}
                  </td>
                  <td style={{ ...td, color: "var(--green)", fontWeight: 600 }}>${p.amountUsdc}</td>
                  <td style={td}>{p.settlementMode}</td>
                  <td style={td}>
                    {p.txHash ? (
                      <a
                        href={`https://sepolia.basescan.org/tx/${p.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--teal)", fontSize: "11px", fontFamily: "monospace" }}
                      >
                        {truncate(p.txHash, 8)}
                      </a>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(p.verifiedAt).toLocaleString()}</td>
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

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--text)",
  fontSize: "12px",
  outline: "none",
  minWidth: "160px",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "var(--surface-3)",
  border: "1px solid var(--border-2)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-2)",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
};

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
