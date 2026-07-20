"use client";

const TYPE_COLORS: Record<string, string> = {
  workflow: "#4a7aaa",
  guard:    "#3a9e5f",
  proof:    "#c8763a",
  payment:  "#c84b8a",
  chain:    "#7a5aaa",
  hitl:     "#c8a030",
};

const STATUS_ICONS: Record<string, string> = {
  success:  "✓",
  failed:   "✗",
  pending:  "◎",
  rejected: "⊘",
};

const STATUS_COLORS: Record<string, string> = {
  success:  "var(--green)",
  failed:   "var(--red)",
  pending:  "var(--yellow)",
  rejected: "var(--text-muted)",
};

interface Event {
  type: string;
  label: string;
  status: string;
  createdAt?: string;
}

interface Props {
  events: Record<string, unknown>[];
  status: string;
}

const RUN_STATUS_COLOR: Record<string, string> = {
  running:            "var(--yellow)",
  awaiting_approval:  "var(--yellow)",
  approved_by_human:  "var(--green)",
  rejected_by_human:  "var(--red)",
  completed:          "var(--green)",
  failed:             "var(--red)",
};

export function WorkflowTimeline({ events, status }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Workflow
        </p>
        <span style={{
          fontSize: "0.7rem",
          color: RUN_STATUS_COLOR[status] ?? "var(--text-muted)",
          fontWeight: 600,
          textTransform: "uppercase",
        }}>
          {status.replace(/_/g, " ")}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {(events as unknown as Event[]).map((ev, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 8px",
              borderRadius: "4px",
              background: "var(--surface-2)",
              borderLeft: `3px solid ${TYPE_COLORS[ev.type] ?? "#444"}`,
            }}
          >
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              color: STATUS_COLORS[ev.status] ?? "var(--text-muted)",
              minWidth: "12px",
              textAlign: "center",
            }}>
              {STATUS_ICONS[ev.status] ?? "·"}
            </span>
            <span style={{ fontSize: "12px", color: "var(--text)", flex: 1 }}>
              {ev.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
