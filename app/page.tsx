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

  // Poll run state while active
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
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: "100vh" }}>
      {/* Left panel */}
      <aside style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>
            ⬡ PRAXIS
          </h1>
          <DemoModeBadge />
        </div>

        <ChatPanel onSubmit={handleSubmit} loading={loading} />

        {run && (
          <WorkflowTimeline events={events} status={status ?? "running"} />
        )}
      </aside>

      {/* Right panel */}
      <main style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
        {!run && !loading && (
          <EmptyState />
        )}

        {loading && (
          <LoadingState />
        )}

        {run && (
          <>
            {run.quoteJson && <VendorQuoteCard quote={run.quoteJson as Record<string, unknown>} />}
            {(run.budgetJson || run.policyJson) && (
              <PolicyCheckCard
                budget={run.budgetJson as Record<string, unknown> | undefined}
                policy={run.policyJson as Record<string, unknown> | undefined}
              />
            )}
            {run.proofJson && (
              <ProofViewer
                proof={run.proofJson as Record<string, unknown>}
                proofHash={run.proofHash as string}
              />
            )}
            {run.receiptJson && (
              <PaymentCard receipt={run.receiptJson as Record<string, unknown>} />
            )}
            {run.chainAnchorJson && (
              <ChainAnchorCard anchor={run.chainAnchorJson as Record<string, unknown>} />
            )}
          </>
        )}
      </main>

      {/* HITL approval modal */}
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
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "12px",
      color: "var(--text-muted)", textAlign: "center", marginTop: "80px",
    }}>
      <div style={{ fontSize: "2.5rem" }}>⬡</div>
      <p style={{ fontSize: "1rem", color: "#555" }}>Submit a procurement prompt to start</p>
      <p style={{ fontSize: "0.8rem", color: "#3a3a3a" }}>
        Try: "Order 2 Dell XPS 15 from TechVendor Inc"
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      color: "var(--text-muted)", marginTop: "40px",
    }}>
      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
      Running procurement workflow…
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
