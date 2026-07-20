"use client";

import { Card, Row, Divider } from "./vendor-quote-card";

interface Props {
  budget?: Record<string, unknown>;
  policy?: Record<string, unknown>;
}

export function PolicyCheckCard({ budget, policy }: Props) {
  const budgetOk = budget?.approved === true;
  const policyOk = policy?.approved === true;

  return (
    <Card title="Guards" accentColor="var(--green)" accentFill="var(--green-fill)" icon="⬡">
      {budget && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <GuardHeader label="Budget Guard" ok={budgetOk} />
          <Row label="Remaining budget" value={`$${Number(budget.remainingBudgetUsd ?? 0).toLocaleString()}`} />
          <Row label="Reason" value={String(budget.reason ?? "—")} />
          {policy && <Divider />}
        </div>
      )}

      {policy && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <GuardHeader label="Policy Guard" ok={policyOk} />
          {Array.isArray(policy.violatedPolicies) && (policy.violatedPolicies as string[]).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {(policy.violatedPolicies as string[]).map((v, i) => (
                <span key={i} style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: "99px",
                  background: "var(--red-fill)",
                  color: "var(--red)",
                  border: "1px solid rgba(204,85,85,0.25)",
                }}>
                  {v}
                </span>
              ))}
            </div>
          )}
          <Row label="Reason" value={String(policy.reason ?? "—")} />
        </div>
      )}
    </Card>
  );
}

function GuardHeader({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "7px 10px",
      background: ok ? "var(--green-fill)" : "var(--red-fill)",
      border: `1px solid ${ok ? "rgba(74,173,111,0.2)" : "rgba(204,85,85,0.2)"}`,
      borderRadius: "var(--radius)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: ok ? "var(--green)" : "var(--red)",
          display: "inline-block",
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: "12px",
          fontWeight: 600,
          color: ok ? "var(--green)" : "var(--red)",
        }}>
          {label}
        </span>
      </div>
      <span style={{
        fontSize: "10px",
        fontWeight: 700,
        color: ok ? "var(--green)" : "var(--red)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}>
        {ok ? "Passed" : "Failed"}
      </span>
    </div>
  );
}
