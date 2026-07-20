"use client";

const TYPE_META: Record<string, { color: string; fill: string; icon: string }> = {
  workflow: { color: "var(--blue)",   fill: "var(--blue-fill)",   icon: "◈" },
  guard:    { color: "var(--green)",  fill: "var(--green-fill)",  icon: "⬡" },
  proof:    { color: "var(--orange)", fill: "var(--orange-fill)", icon: "◉" },
  payment:  { color: "var(--pink)",   fill: "var(--pink-fill)",   icon: "◈" },
  chain:    { color: "var(--purple)", fill: "var(--purple-fill)", icon: "⬡" },
  hitl:     { color: "var(--yellow)", fill: "var(--yellow-fill)", icon: "◎" },
};

const STATUS_META: Record<string, { icon: string; color: string }> = {
  success:  { icon: "✓", color: "var(--green)" },
  failed:   { icon: "✗", color: "var(--red)" },
  pending:  { icon: "◌", color: "var(--yellow)" },
  rejected: { icon: "⊘", color: "var(--text-muted)" },
};

const RUN_STATUS: Record<string, { label: string; color: string; fill: string }> = {
  running:            { label: "Running",           color: "var(--yellow)", fill: "var(--yellow-fill)" },
  awaiting_approval:  { label: "Awaiting Approval", color: "var(--yellow)", fill: "var(--yellow-fill)" },
  approved_by_human:  { label: "Approved",          color: "var(--green)",  fill: "var(--green-fill)" },
  rejected_by_human:  { label: "Rejected",          color: "var(--red)",    fill: "var(--red-fill)" },
  completed:          { label: "Completed",         color: "var(--green)",  fill: "var(--green-fill)" },
  failed:             { label: "Failed",            color: "var(--red)",    fill: "var(--red-fill)" },
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

export function WorkflowTimeline({ events, status }: Props) {
  const runMeta = RUN_STATUS[status] ?? { label: status, color: "var(--text-muted)", fill: "transparent" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.18em",
        }}>
          Workflow
        </p>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          fontSize: "10px",
          fontWeight: 700,
          color: runMeta.color,
          background: runMeta.fill,
          border: `1px solid ${runMeta.color}`,
          borderRadius: "99px",
          padding: "2px 8px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          {status === "running" || status === "awaiting_approval" ? (
            <span style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: runMeta.color,
              display: "inline-block",
              animation: "pulse-dot 1.4s ease-in-out infinite",
            }} />
          ) : (
            <span style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: runMeta.color,
              display: "inline-block",
            }} />
          )}
          {runMeta.label}
        </span>
      </div>

      {/* Event list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {(events as unknown as Event[]).map((ev, i) => {
          const typeMeta   = TYPE_META[ev.type]   ?? { color: "var(--border-2)", fill: "transparent", icon: "·" };
          const statusMeta = STATUS_META[ev.status] ?? { icon: "·", color: "var(--text-muted)" };

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "7px 10px",
                borderRadius: "var(--radius)",
                background: "var(--surface-2)",
                border: "1px solid var(--border-3)",
                borderLeft: `2px solid ${typeMeta.color}`,
              }}
            >
              {/* Type dot */}
              <span style={{
                width: "18px", height: "18px",
                borderRadius: "var(--radius-sm)",
                background: typeMeta.fill,
                border: `1px solid ${typeMeta.color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "9px",
                color: typeMeta.color,
                flexShrink: 0,
              }}>
                {typeMeta.icon}
              </span>

              {/* Label */}
              <span style={{ fontSize: "12px", color: "var(--text-2)", flex: 1, lineHeight: 1.4 }}>
                {ev.label}
              </span>

              {/* Status */}
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                color: statusMeta.color,
                flexShrink: 0,
              }}>
                {statusMeta.icon}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
