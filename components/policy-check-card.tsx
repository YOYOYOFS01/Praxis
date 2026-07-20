"use client";

import { Card, Row } from "./vendor-quote-card";

interface Props {
  budget?: Record<string, unknown>;
  policy?: Record<string, unknown>;
}

export function PolicyCheckCard({ budget, policy }: Props) {
  const budgetOk = budget?.approved === true;
  const policyOk = policy?.approved === true;

  return (
    <Card title="Guards" borderColor="var(--green)">
      {budget && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Dot ok={budgetOk} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: budgetOk ? "var(--green)" : "var(--red)" }}>
              Budget Guard {budgetOk ? "Passed" : "FAILED"}
            </span>
          </div>
          <Row label="Remaining budget" value={`$${Number(budget.remainingBudgetUsd ?? 0).toLocaleString()}`} />
          <Row label="Reason"           value={String(budget.reason ?? "—")} />
        </div>
      )}

      {policy && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Dot ok={policyOk} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: policyOk ? "var(--green)" : "var(--red)" }}>
              Policy Guard {policyOk ? "Passed" : "FAILED"}
            </span>
          </div>
          {Array.isArray(policy.violatedPolicies) && (policy.violatedPolicies as string[]).length > 0 && (
            <Row label="Violations" value={(policy.violatedPolicies as string[]).join(", ")} />
          )}
          <Row label="Reason" value={String(policy.reason ?? "—")} />
        </div>
      )}
    </Card>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      width: "8px", height: "8px", borderRadius: "50%",
      background: ok ? "var(--green)" : "var(--red)",
      display: "inline-block", flexShrink: 0,
    }} />
  );
}
