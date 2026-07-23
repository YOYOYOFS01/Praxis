"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { VendorQuoteCard } from "@/components/vendor-quote-card";
import { PolicyCheckCard } from "@/components/policy-check-card";
import { ProofViewer } from "@/components/proof-viewer";
import { PaymentCard } from "@/components/payment-card";
import { ChainAnchorCard } from "@/components/chain-anchor-card";
import { ApprovalModal } from "@/components/approval-modal";
import { DemoModeBadge } from "@/components/demo-mode-badge";

export default function Dashboard() {
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchRun = useCallback(async (id: string) => {
    const res = await fetch(`/api/runs/${id}`);
    if (res.ok) {
      const data = await res.json();
      setRun(data);
      return data;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!runId || !polling) return;
    const interval = setInterval(async () => {
      const data = await fetchRun(runId);
      if (data && ["completed", "failed", "rejected_by_human"].includes(data.status as string)) {
        setPolling(false);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [runId, polling, fetchRun]);

  const handleSubmit = async (prompt: string) => {
    setLoading(true);
    setRun(null);
    setRunId(null);
    try {
      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setRunId(data.runId);
      setRun(data.run ?? null);
      setPolling(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!runId) return;
    const res = await fetch(`/api/runs/${runId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    const data = await res.json();
    setRun(data.run ?? null);
    setPolling(true);
  };

  const events = (run?.events as Record<string, unknown>[] | undefined) ?? [];
  const status = run?.status as string | undefined;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "320px 1fr",
      minHeight: "100vh",
      background: "var(--bg)",
    }}>
      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div style={{
              width: "28px", height: "28px",
              background: "var(--orange-fill)",
              border: "1px solid rgba(212,131,74,0.25)",
              borderRadius: "var(--radius-md)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px",
            }}>
              ⬡
            </div>
            <span style={{
              fontSize: "14px", fontWeight: 700,
              letterSpacing: "-0.02em", color: "var(--text)",
            }}>
              Praxis
            </span>
          </div>
          <DemoModeBadge />
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}>
          <ChatPanel onSubmit={handleSubmit} loading={loading} />
          {run && <WorkflowTimeline events={events} status={status ?? "running"} />}
        </div>
      </aside>

      {/* ── Right main panel ─────────────────────────────────────────── */}
      <main style={{
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        overflowY: "auto",
        minHeight: "100vh",
      }}>
        {!run && !loading && <EmptyState />}
        {loading && <LoadingState />}

        {run && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!!run.quoteJson && (
              <VendorQuoteCard quote={run.quoteJson as Record<string, unknown>} />
            )}
            {!!(run.budgetJson || run.policyJson) && (
              <PolicyCheckCard
                budget={run.budgetJson as Record<string, unknown> | undefined}
                policy={run.policyJson as Record<string, unknown> | undefined}
              />
            )}
            {!!run.proofJson && (
              <ProofViewer
                proof={run.proofJson as Record<string, unknown>}
                proofHash={run.proofHash as string}
              />
            )}
            {!!run.receiptJson && (
              <PaymentCard receipt={run.receiptJson as Record<string, unknown>} />
            )}
            {!!run.chainAnchorJson && (
              <ChainAnchorCard anchor={run.chainAnchorJson as Record<string, unknown>} />
            )}
          </div>
        )}
      </main>

      {/* ── HITL modal ───────────────────────────────────────────────── */}
      {status === "awaiting_approval" && run && (
        <ApprovalModal
          run={run}
          onApprove={() => handleApproval(true)}
          onReject={() => handleApproval(false)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "16px",
      minHeight: "60vh",
      textAlign: "center",
    }}>
      <div style={{
        width: "56px", height: "56px",
        background: "var(--orange-fill)",
        border: "1px solid rgba(212,131,74,0.2)",
        borderRadius: "var(--radius-xl)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "24px",
      }}>
        ⬡
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>
          Ready to procure
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "320px", lineHeight: 1.6 }}>
          Submit a procurement prompt on the left to start an autonomous payment workflow
        </p>
      </div>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginTop: "8px",
        width: "100%",
        maxWidth: "420px",
      }}>
        {[
          "Order 2 Dell XPS 15 from TechVendor Inc",
          "Purchase 5 MacBook Pro M3 from Apple Business Store",
        ].map((ex) => (
          <div key={ex} style={{
            padding: "10px 14px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "12px",
            color: "var(--text-2)",
            textAlign: "left",
          }}>
            <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>e.g.</span>
            {ex}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "20px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      marginTop: "32px",
      maxWidth: "360px",
    }}>
      <span style={{
        animation: "spin 0.9s linear infinite",
        display: "inline-block",
        color: "var(--orange)",
        fontSize: "16px",
        flexShrink: 0,
      }}>
        ◌
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>
          Running procurement workflow
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Agents are processing your request…
        </span>
      </div>
    </div>
  );
}
