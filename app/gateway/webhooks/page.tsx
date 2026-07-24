// Webhook Delivery Log — server component (direct Prisma access)
// Shows WebhookDelivery rows with status, retry info, and event type.
// Requirements: 16.5

import { prisma } from "@/src/db/prisma";

const STATUS_COLORS: Record<string, string> = {
  queued: "var(--orange)",
  delivered: "var(--green)",
  dead: "var(--red)",
};

const STATUS_BG: Record<string, string> = {
  queued: "var(--orange-fill)",
  delivered: "var(--green-fill)",
  dead: "var(--red-fill)",
};

const STATUSES = ["queued", "delivered", "dead"] as const;

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

function fmtDate(s: Date | null | undefined): string {
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

const LIMIT = 25;

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: { status?: string; event?: string; page?: string };
}) {
  const statusFilter = searchParams.status ?? "";
  const eventFilter = searchParams.event ?? "";
  const page = parseInt(searchParams.page ?? "1", 10);
  const skip = (page - 1) * LIMIT;

  const where: { status?: string; event?: { contains: string } } = {};
  if (statusFilter) where.status = statusFilter;
  if (eventFilter) where.event = { contains: eventFilter };

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: LIMIT,
    }),
    prisma.webhookDelivery.count({ where }),
  ]);

  const pages = Math.ceil(total / LIMIT);
  const start = total === 0 ? 0 : skip + 1;
  const end = Math.min(skip + LIMIT, total);

  function pageUrl(p: number) {
    const ps = new URLSearchParams({
      ...(statusFilter && { status: statusFilter }),
      ...(eventFilter && { event: eventFilter }),
      page: String(p),
    });
    return `/gateway/webhooks?${ps.toString()}`;
  }

  function statusUrl(s: string) {
    const ps = new URLSearchParams({
      ...(s && { status: s }),
      ...(eventFilter && { event: eventFilter }),
    });
    return `/gateway/webhooks?${ps.toString()}`;
  }

  return (
    <div style={{ padding: "32px", background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <a href="/gateway" style={{ fontSize: "12px", color: "var(--text-muted)" }}>← Gateway</a>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginTop: "8px" }}>
          Webhook Delivery Log
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
          Track async webhook deliveries and retry history
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Status filter */}
        <div style={{ display: "flex", gap: "6px" }}>
          {(["", ...STATUSES] as string[]).map((s) => {
            const active = statusFilter === s;
            return (
              <a key={s || "all"} href={statusUrl(s)} style={{
                padding: "5px 12px",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
                fontWeight: active ? 600 : 400,
                border: `1px solid ${active ? (STATUS_COLORS[s] ?? "var(--border-2)") : "var(--border)"}`,
                background: active ? (STATUS_BG[s] ?? "var(--surface-2)") : "var(--surface)",
                color: active ? (STATUS_COLORS[s] ?? "var(--text)") : "var(--text-2)",
                textDecoration: "none",
              }}>
                {s || "ALL"}
              </a>
            );
          })}
        </div>

        {/* Event filter form */}
        <form method="GET" style={{ display: "flex", gap: "8px" }}>
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <input
            name="event"
            defaultValue={eventFilter}
            placeholder="Filter by event type"
            style={{
              padding: "5px 10px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--text)",
              fontSize: "12px",
              outline: "none",
              minWidth: "200px",
            }}
          />
          <button type="submit" style={{
            padding: "5px 12px",
            background: "var(--surface-3)",
            border: "1px solid var(--border-2)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-2)",
            fontSize: "12px",
            cursor: "pointer",
          }}>
            Filter
          </button>
        </form>
      </div>

      {/* Count */}
      {total > 0 && (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Showing {start}–{end} of {total} deliveries
        </div>
      )}

      {/* Table */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        {deliveries.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            No webhook deliveries yet.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Event", "Endpoint ID", "Status", "Attempts", "Response", "Next Retry", "Created / Delivered"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "11px", color: "var(--teal)" }}>
                    {d.event}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "11px" }}>
                    {truncate(d.endpointId, 10)}
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: STATUS_BG[d.status] ?? "rgba(255,255,255,0.05)",
                      color: STATUS_COLORS[d.status] ?? "var(--text-2)",
                    }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "center" as const }}>{d.attemptCount}</td>
                  <td style={{ ...td, color: d.responseStatus && d.responseStatus >= 200 && d.responseStatus < 300 ? "var(--green)" : "var(--red)" }}>
                    {d.responseStatus ?? "—"}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontSize: "11px" }}>
                    {d.status === "queued" ? fmtDate(d.nextRetryAt) : "—"}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontSize: "11px" }}>
                    {fmtDate(d.deliveredAt ?? d.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", alignItems: "center" }}>
          {page > 1 && (
            <a href={pageUrl(page - 1)} style={paginationBtn}>← Prev</a>
          )}
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <a href={pageUrl(page + 1)} style={paginationBtn}>Next →</a>
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
