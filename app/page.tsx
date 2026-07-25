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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        if (data.status === "failed") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lastErr = (data.events as Record<string, any>[] | undefined)?.slice().reverse().find((e) => e.status === "failed")?.payload?.error;
          setErrorMsg(lastErr || "Workflow terminated with failed status.");
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [runId, polling, fetchRun]);

  const handleSubmit = async (prompt: string) => {
    setLoading(true);
    setRun(null);
    setRunId(null);
    setErrorMsg(null);
    try {
      const isMock = typeof window !== "undefined" ? localStorage.getItem("praxis_mock_mode") !== "false" : true;
      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mock-mode": String(isMock),
          "x-demo-mode": String(isMock),
        },
        body: JSON.stringify({ prompt, mockMode: isMock }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `HTTP ${res.status}: Failed to start procurement workflow`);
        setLoading(false);
        return;
      }
      setRunId(data.runId);
      setRun(data.run ?? null);
      if (data.run?.status === "failed") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errPayload = (data.run?.events as Record<string, any>[] | undefined)?.slice().reverse().find((e) => e.status === "failed")?.payload?.error;
        setErrorMsg(errPayload || "Procurement workflow failed during execution");
        setPolling(false);
      } else {
        setPolling(true);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!runId) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/runs/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `Failed to submit approval decision (HTTP ${res.status})`);
        return;
      }
      setRun(data.run ?? null);
      setPolling(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(String(err));
    }
  };

  const events = (run?.events as Record<string, unknown>[] | undefined) ?? [];
  const status = run?.status as string | undefined;

  return (
    <div className="flex flex-col lg:flex-row gap-xl w-full">
      {/* ── Left Panel: Chat ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-[380px] flex flex-col gap-lg flex-shrink-0">
        <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-lg flex flex-col shadow-sm lg:sticky lg:top-[88px] lg:h-[calc(100vh-120px)] overflow-hidden">
          <div className="mb-md flex items-center justify-between border-b border-outline-variant/30 pb-sm">
            <h2 className="font-display text-lg font-bold text-on-surface tracking-tight">
              Agent Interaction
            </h2>
            <DemoModeBadge />
          </div>
          <div className="flex-1 overflow-y-auto pr-sm custom-scrollbar flex flex-col gap-lg pb-md">
            <ChatPanel onSubmit={handleSubmit} loading={loading} />
            {run && (
              <div className="bg-surface-container-high/30 p-md rounded-xl border border-outline-variant/20">
                <WorkflowTimeline events={events} status={status ?? "running"} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Results ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-lg overflow-y-auto pb-xl">
        {errorMsg && (
          <div style={{
            background: "rgba(204, 85, 85, 0.12)",
            border: "1px solid rgba(204, 85, 85, 0.4)",
            borderRadius: "var(--radius-lg, 12px)",
            padding: "16px 20px",
            color: "#ff6b6b",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "12px",
            boxShadow: "0 4px 20px rgba(204, 85, 85, 0.15)",
          }}>
            <span style={{ fontSize: "20px", flexShrink: 0 }}>⚠</span>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
                Procurement Pipeline Error
              </h3>
              <p style={{ fontSize: "13px", lineHeight: 1.5, opacity: 0.9 }}>
                {errorMsg}
              </p>
            </div>
          </div>
        )}

        {status === "awaiting_approval" && run && (
          <div style={{
            background: "linear-gradient(135deg, rgba(212, 168, 64, 0.15), rgba(212, 168, 64, 0.05))",
            border: "1px solid var(--yellow, #d4a840)",
            borderRadius: "var(--radius-xl, 16px)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            boxShadow: "0 8px 32px rgba(212, 168, 64, 0.15)",
            backdropFilter: "blur(12px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "40px", height: "40px",
                background: "var(--yellow, #d4a840)",
                borderRadius: "10px",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#000", fontSize: "20px", fontWeight: "bold",
                boxShadow: "0 0 16px rgba(212, 168, 64, 0.5)",
              }}>
                🛡️
              </div>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--yellow, #d4a840)", letterSpacing: "-0.01em" }}>
                  Action Required: Pending CFO Approval
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted, #94a3b8)" }}>
                  Human-in-the-Loop intervention triggered. Threshold exceeded or sensitive vendor detected.
                </p>
              </div>
            </div>

            {!!run.intentJson && (
              <div style={{
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                padding: "14px 16px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                fontSize: "13px",
              }}>
                <div>
                  <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", display: "block" }}>Vendor</span>
                  <strong style={{ color: "#fff" }}>{String((run.intentJson as Record<string, unknown>).vendorName ?? "—")}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", display: "block" }}>Item</span>
                  <strong style={{ color: "#fff" }}>{String((run.intentJson as Record<string, unknown>).itemDescription ?? "—")}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", display: "block" }}>Quantity</span>
                  <strong style={{ color: "#fff" }}>{String((run.intentJson as Record<string, unknown>).quantity ?? "—")}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", display: "block" }}>Total Amount</span>
                  <strong style={{ color: "var(--yellow, #d4a840)", fontSize: "14px" }}>
                    ${Number((run.intentJson as Record<string, unknown>).totalAmountUsd ?? 0).toLocaleString()} USDC
                  </strong>
                </div>
              </div>
            )}

            {!!run.proofJson && !!(run.proofJson as Record<string, unknown>).agentSummary && (
              <div style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "12.5px",
                color: "#cbd5e1",
                fontStyle: "italic",
                lineHeight: 1.5,
              }}>
                &ldquo;{String((run.proofJson as Record<string, unknown>).agentSummary)}&rdquo;
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
              <button
                onClick={() => handleApproval(true)}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff",
                  border: "1px solid #34d399",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(16, 185, 129, 0.3)"; }}
              >
                ✓ Approve & Execute Payment
              </button>
              <button
                onClick={() => handleApproval(false)}
                style={{
                  flex: 1,
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"; }}
              >
                ✗ Reject
              </button>
            </div>
          </div>
        )}

        {!run && !loading && !errorMsg && <EmptyState />}
        {loading && <LoadingState />}

        {run && (
          <div className="fade-in flex flex-col gap-lg max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-md mb-xs">
              <div>
                <h1 className="font-display text-2xl font-bold text-on-surface tracking-tight">Transaction Details</h1>
                <p className="font-body text-sm text-on-surface-variant">Review agent executions and cryptographic proofs</p>
              </div>
            </div>

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
      </div>

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
    <div className="flex-1 flex flex-col items-center justify-center gap-md min-h-[60vh] text-center px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <div className="relative w-20 h-20 bg-gradient-to-br from-surface to-surface-container-highest border border-outline-variant rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-all duration-300">
          <span className="font-display text-3xl font-bold text-primary">P</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-4">
        <p className="font-display text-2xl font-bold text-on-surface tracking-tight">
          Ready to procure
        </p>
        <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
          Submit a procurement prompt on the left to start an autonomous payment workflow secured by cryptographic guardrails.
        </p>
      </div>
      <div className="flex flex-col gap-3 mt-6 w-full max-w-md">
        {[
          "Order 2 Dell XPS 15 from TechVendor Inc",
          "Purchase 5 MacBook Pro M3 from Apple Business Store",
        ].map((ex) => (
          <div key={ex} className="p-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm text-on-surface text-left shadow-sm hover:border-primary/50 transition-colors cursor-default">
            <span className="text-primary font-medium mr-2">Example:</span>
            {ex}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-4 p-6 bg-surface-container-lowest border border-outline-variant/50 rounded-2xl mt-8 max-w-md shadow-sm">
      <div className="relative flex items-center justify-center">
        <svg className="animate-spin text-primary w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-on-surface tracking-tight">
          Running procurement workflow
        </span>
        <span className="text-xs text-on-surface-variant mt-1">
          Agents are processing your request securely...
        </span>
      </div>
    </div>
  );
}
