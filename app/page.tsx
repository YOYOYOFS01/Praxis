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
    <div className="flex flex-col lg:flex-row gap-xl w-full">
      {/* ── Left Panel: Chat ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-[380px] flex flex-col gap-lg flex-shrink-0">
        <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-lg flex flex-col shadow-sm lg:sticky lg:top-[88px] lg:h-[calc(100vh-120px)] overflow-hidden">
          <div className="mb-md flex items-center justify-between border-b border-outline-variant/30 pb-sm">
            <h2 className="font-display text-lg font-bold text-on-surface flex items-center gap-2 tracking-tight">
              <span className="material-symbols-outlined text-primary text-[20px]">robot_2</span> Agent Interaction
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
        {!run && !loading && <EmptyState />}
        {loading && <LoadingState />}

        {run && (
          <div className="fade-in flex flex-col gap-lg max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-md mb-xs">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
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
          <span className="material-symbols-outlined text-[36px] text-primary">auto_awesome</span>
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
