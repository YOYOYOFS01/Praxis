"use client";

import { useState, useEffect } from "react";
import { ProofDrawer } from "@/components/proof-drawer";

interface HistoryItem {
  id: string;
  status: string;
  prompt: string;
  amount: string;
  date: string;
  proofHash: string;
  proof?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  anchor?: Record<string, unknown>;
}

const FALLBACK_HISTORY: HistoryItem[] = [
  {
    id: "demo-1",
    status: "completed",
    prompt: "Order 2 Dell XPS 15 from TechVendor Inc",
    amount: "3,400.00 USDC",
    date: "2 hours ago",
    proofHash: "0xabc19f8e4e2a8d1c9f3b5a7e6c0d8b2f1a4e9c3d7b5f0a2e6c8d4b1f9a3e7c5b",
    proof: {
      agentSummary: "Procurement approved: 2x Dell XPS 15 from TechVendor Inc for $3,400 USDC — within department budget allowance and vendor passed OFAC sanctions screening.",
      generatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    budget: { approved: true, remainingBudgetUsd: 46600, reason: "Within $50k monthly hardware limit" },
    policy: { approved: true, violatedPolicies: [] },
    anchor: { txHash: "0x7a8e9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a", status: "confirmed" },
  },
  {
    id: "demo-2",
    status: "failed",
    prompt: "Purchase 500 gaming chairs for office",
    amount: "125,000.00 USDC",
    date: "Yesterday",
    proofHash: "0x7f2a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
    proof: {
      agentSummary: "Procurement BLOCKED: 500x gaming chairs from UnknownVendor — exceeded per-transaction threshold ($5,000 USDC cap) and vendor is not on approved IT supply list.",
      generatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    budget: { approved: false, remainingBudgetUsd: 10000, reason: "Exceeds remaining hardware budget of $10,000 USDC" },
    policy: { approved: false, violatedPolicies: ["UNAUTHORIZED_VENDOR", "EXCEEDS_TRANSACTION_LIMIT"] },
  },
  {
    id: "demo-3",
    status: "completed",
    prompt: "Subscribe to Enterprise AI API endpoint services",
    amount: "99.00 USDC",
    date: "Oct 20, 2026",
    proofHash: "0x3cd44ab5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
    proof: {
      agentSummary: "Procurement approved: Enterprise AI API endpoint subscription for $99 USDC — recurring software expenditure approved by policy.",
      generatedAt: "2026-10-20T10:00:00Z",
    },
    budget: { approved: true, remainingBudgetUsd: 9901, reason: "Within software subscription allowance" },
    policy: { approved: true, violatedPolicies: [] },
    anchor: { txHash: "0x8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f", status: "confirmed" },
  },
];

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>(FALLBACK_HISTORY);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadRuns() {
      try {
        const res = await fetch("/api/runs");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const formatted = data.map((r: any) => ({
              id: r.id,
              status: r.status || "completed",
              prompt: r.prompt || "Autonomous procurement run",
              amount: r.intentJson?.totalAmountUsd ? `${Number(r.intentJson.totalAmountUsd).toLocaleString()} USDC` : "—",
              date: r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
              proofHash: r.proofHash || "0x" + Math.random().toString(16).slice(2, 18),
              proof: r.proofJson,
              budget: r.budgetJson,
              policy: r.policyJson,
              anchor: r.chainAnchorJson,
            }));
            setItems([...formatted, ...FALLBACK_HISTORY]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch runs:", err);
      }
    }
    loadRuns();
  }, []);

  const handleRowClick = (item: HistoryItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const filtered = items.filter((i) =>
    i.prompt.toLowerCase().includes(search.toLowerCase()) ||
    i.proofHash.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Run History</h1>
          <p className="text-secondary">Click on any past autonomous execution or proof hash to open the On-Chain Cryptographic Proof Explorer.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="glass-input text-sm py-2 px-3 w-64"
            placeholder="Search prompts or hashes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-secondary text-sm">
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Prompt</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium text-right">Proof Hash (Click to Verify)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const badgeClass =
                item.status === "completed" || item.status === "success" ? "status-success"
                : item.status === "failed" || item.status === "rejected_by_human" ? "status-failed"
                : "status-pending";

              const statusLabel =
                item.status === "completed" || item.status === "success" ? "Success"
                : item.status === "failed" || item.status === "rejected_by_human" ? "Blocked / Failed"
                : item.status === "awaiting_approval" ? "HITL Approval"
                : "Pending";

              return (
                <tr
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                  title="Click to open On-Chain Cryptographic Proof Drawer"
                >
                  <td className="p-4">
                    <span className={`status-badge ${badgeClass}`}>{statusLabel}</span>
                  </td>
                  <td className="p-4 truncate max-w-xs text-sm font-medium text-white group-hover:text-[var(--teal,#00f5d4)] transition-colors">
                    {item.prompt}
                  </td>
                  <td className="p-4 font-semibold text-sm">{item.amount}</td>
                  <td className="p-4 text-sm text-secondary">{item.date}</td>
                  <td className="p-4 text-right font-mono text-xs text-secondary group-hover:text-white flex items-center justify-end gap-2">
                    <span className="text-[var(--teal,#00f5d4)] opacity-75 group-hover:opacity-100">◉</span>
                    {item.proofHash.slice(0, 10)}...{item.proofHash.slice(-4)}
                    <span className="text-[10px] font-sans text-secondary group-hover:text-[var(--teal,#00f5d4)] underline">(Verify ↗)</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ProofDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        proof={selectedItem?.proof}
        proofHash={selectedItem?.proofHash}
        budget={selectedItem?.budget}
        policy={selectedItem?.policy}
        anchor={selectedItem?.anchor}
      />
    </div>
  );
}
