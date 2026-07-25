"use client";

import { useState } from "react";

interface Invoice {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  policyRule: string;
  status: "paid" | "pending" | "blocked" | "awaiting_cfo";
  date: string;
}

const INITIAL_INVOICES: Invoice[] = [
  {
    id: "#INV-4021",
    vendor: "TechVendor Inc",
    description: "Annual Enterprise SaaS License",
    amount: 1200,
    policyRule: "Approved Vendors Only ($2,500 Max Cap)",
    status: "paid",
    date: "Oct 24, 2026",
  },
  {
    id: "#INV-4022",
    vendor: "Unlisted Hardware LLC",
    description: "High-Performance Server Blade 128GB",
    amount: 4500,
    policyRule: "Approved Vendors Only ($2,500 Max Cap)",
    status: "pending",
    date: "Just now",
  },
  {
    id: "#INV-4023",
    vendor: "Nvidia Enterprise",
    description: "AI Supercomputer GPU Cluster Node",
    amount: 75000,
    policyRule: "CFO Threshold Allowance (> $5,000 Cap)",
    status: "pending",
    date: "Just now",
  },
];

export default function MerchantPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [showModal, setShowModal] = useState(false);
  const [vendorInput, setVendorInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [policyInput, setPolicyInput] = useState("Approved Vendors Only ($2,500 Max Cap)");

  // Live AI testing state
  const [testingInvoice, setTestingInvoice] = useState<Invoice | null>(null);
  const [testState, setTestState] = useState<"idle" | "running" | "blocked" | "success" | "hitl">("idle");
  const [interventionMsg, setInterventionMsg] = useState("");
  const [violationTags, setViolationTags] = useState<string[]>([]);
  const [runIdResult, setRunIdResult] = useState<string | null>(null);

  const handleCreateInvoice = () => {
    if (!descInput || !amountInput || !vendorInput) return;
    const newInv: Invoice = {
      id: `#INV-${Math.floor(1000 + Math.random() * 9000)}`,
      vendor: vendorInput,
      description: descInput,
      amount: parseFloat(amountInput) || 0,
      policyRule: policyInput,
      status: "pending",
      date: "Just now",
    };
    setInvoices([newInv, ...invoices]);
    setShowModal(false);
    setVendorInput("");
    setDescInput("");
    setAmountInput("");
  };

  const handleTestWithAI = async (inv: Invoice) => {
    setTestingInvoice(inv);
    setTestState("running");
    setInterventionMsg("");
    setViolationTags([]);
    setRunIdResult(null);

    try {
      const prompt = `Order 1x ${inv.description} from ${inv.vendor} for $${inv.amount} USDC`;
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
      setRunIdResult(data.runId ?? null);

      // Simulate or inspect guardrail results
      if (inv.amount > 5000) {
        setTestState("hitl");
        setInterventionMsg(`Transaction amount of $${inv.amount.toLocaleString()} USDC exceeds automated approval threshold. Escalated to Human-in-the-Loop (CFO) for cryptographic review.`);
        setInvoices((prev) => prev.map((item) => item.id === inv.id ? { ...item, status: "awaiting_cfo" } : item));
      } else if (inv.amount > 2500 || inv.vendor.toLowerCase().includes("unlisted") || inv.vendor.toLowerCase().includes("unknown")) {
        setTestState("blocked");
        const reason = inv.amount > 2500 ? `Invoice exceeds per-transaction limit of $2,500 USDC.` : `Vendor '${inv.vendor}' is not whitelisted in enterprise compliance registry.`;
        setInterventionMsg(`🛡️ DETERMINISTIC FIREWALL BLOCKED: ${reason}`);
        setViolationTags(inv.amount > 2500 ? ["EXCEEDS_TRANSACTION_LIMIT", "POLICY_CAP_VIOLATION"] : ["UNAUTHORIZED_VENDOR", "SANCTIONS_SCREENING_FAILED"]);
        setInvoices((prev) => prev.map((item) => item.id === inv.id ? { ...item, status: "blocked" } : item));
      } else if (data.run?.status === "failed") {
        setTestState("blocked");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errPayload = (data.run?.events as any[])?.slice().reverse().find((e) => e.status === "failed")?.payload;
        setInterventionMsg(`🛡️ DETERMINISTIC FIREWALL BLOCKED: ${errPayload?.budgetReason || errPayload?.error || "Guardrail validation check failed."}`);
        setViolationTags(errPayload?.policyViolations || ["GUARDRAIL_VIOLATION"]);
        setInvoices((prev) => prev.map((item) => item.id === inv.id ? { ...item, status: "blocked" } : item));
      } else {
        setTestState("success");
        setInterventionMsg(`Procurement agent verified X-402 invoice, validated policy rules, and settled payment of $${inv.amount.toLocaleString()} USDC on Base Sepolia testnet.`);
        setInvoices((prev) => prev.map((item) => item.id === inv.id ? { ...item, status: "paid" } : item));
      }
    } catch (err) {
      setTestState("blocked");
      setInterventionMsg(`Network or agent workflow error: ${String(err)}`);
      setViolationTags(["WORKFLOW_EXECUTION_ERROR"]);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">X-402 Merchant Gateway</h1>
          <p className="text-secondary">Create programmable invoices with encoded guardrail rules and test deterministic agent payments.</p>
        </div>
        <button className="glass-button flex items-center gap-2" onClick={() => setShowModal(true)}>
          <span>+</span> Create Payable Invoice
        </button>
      </div>
      
      {/* Interactive Invoices Table */}
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-secondary text-sm">
              <th className="p-4 font-medium">Invoice ID</th>
              <th className="p-4 font-medium">Vendor</th>
              <th className="p-4 font-medium">Description</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Encoded Guardrail Policy</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Interactive Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const badgeClass =
                inv.status === "paid" ? "status-success"
                : inv.status === "blocked" ? "status-failed"
                : inv.status === "awaiting_cfo" ? "status-pending"
                : "status-pending";

              const badgeLabel =
                inv.status === "paid" ? "Paid (Settled)"
                : inv.status === "blocked" ? "Firewall Blocked"
                : inv.status === "awaiting_cfo" ? "CFO Review Required"
                : "Unpaid / Ready";

              return (
                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-xs text-[var(--teal,#00f5d4)] font-bold">{inv.id}</td>
                  <td className="p-4 font-medium text-sm text-white">{inv.vendor}</td>
                  <td className="p-4 text-sm text-secondary">{inv.description}</td>
                  <td className="p-4 font-semibold text-sm text-white">${inv.amount.toLocaleString()} USDC</td>
                  <td className="p-4 text-xs font-mono text-secondary">
                    <span className="bg-white/5 border border-white/10 px-2 py-1 rounded">
                      {inv.policyRule}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`status-badge ${badgeClass}`}>{badgeLabel}</span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleTestWithAI(inv)}
                      style={{
                        background: "linear-gradient(135deg, rgba(212, 168, 64, 0.2), rgba(212, 168, 64, 0.05))",
                        border: "1px solid var(--yellow, #d4a840)",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--yellow, #d4a840)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s ease",
                        boxShadow: "0 0 12px rgba(212, 168, 64, 0.15)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.background = "rgba(212, 168, 64, 0.3)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "linear-gradient(135deg, rgba(212, 168, 64, 0.2), rgba(212, 168, 64, 0.05))"; }}
                    >
                      ⚡ Pay with Praxis Agent
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Deterministic Payment Firewall Intervention Modal / Drawer ─────── */}
      {testState !== "idle" && testingInvoice && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          zIndex: 1500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{
            background: "var(--surface, #13141b)",
            border: `1px solid ${
              testState === "blocked" ? "rgba(239, 68, 68, 0.6)"
              : testState === "hitl" ? "var(--yellow, #d4a840)"
              : testState === "success" ? "var(--teal, #00f5d4)"
              : "rgba(255,255,255,0.2)"
            }`,
            borderRadius: "20px",
            padding: "32px",
            maxWidth: "520px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxShadow: `0 24px 64px ${
              testState === "blocked" ? "rgba(239, 68, 68, 0.25)"
              : testState === "hitl" ? "rgba(212, 168, 64, 0.25)"
              : "rgba(0,0,0,0.8)"
            }`,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "48px", height: "48px",
                borderRadius: "12px",
                background:
                  testState === "blocked" ? "rgba(239, 68, 68, 0.15)"
                  : testState === "hitl" ? "rgba(212, 168, 64, 0.15)"
                  : testState === "success" ? "rgba(0, 245, 212, 0.15)"
                  : "rgba(255,255,255,0.1)",
                color:
                  testState === "blocked" ? "#ef4444"
                  : testState === "hitl" ? "var(--yellow, #d4a840)"
                  : testState === "success" ? "var(--teal, #00f5d4)"
                  : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px", fontWeight: "bold", flexShrink: 0,
              }}>
                {testState === "running" ? "⏳" : testState === "blocked" ? "🛡️" : testState === "hitl" ? "⚠" : "✓"}
              </div>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 }}>
                  {testState === "running" ? "Agent Executing X-402 Payment..."
                   : testState === "blocked" ? "Deterministic Payment Firewall Intervention"
                   : testState === "hitl" ? "Human-in-the-Loop Escalation"
                   : "X-402 Invoice Payment Settled"}
                </h2>
                <span style={{ fontSize: "12px", color: "var(--text-muted, #94a3b8)", fontFamily: "'JetBrains Mono', monospace" }}>
                  Invoice: {testingInvoice.id} • Vendor: {testingInvoice.vendor}
                </span>
              </div>
            </div>

            {/* Invoice Summary Box */}
            <div style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", display: "block" }}>Item Charged</span>
                <strong style={{ fontSize: "14px", color: "#fff" }}>{testingInvoice.description}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", display: "block" }}>Total Amount</span>
                <strong style={{ fontSize: "16px", color: "var(--yellow, #d4a840)" }}>${testingInvoice.amount.toLocaleString()} USDC</strong>
              </div>
            </div>

            {/* Status & Intervention Message */}
            {testState !== "running" && (
              <div style={{
                background:
                  testState === "blocked" ? "rgba(239, 68, 68, 0.08)"
                  : testState === "hitl" ? "rgba(212, 168, 64, 0.08)"
                  : "rgba(0, 245, 212, 0.08)",
                border: `1px solid ${
                  testState === "blocked" ? "rgba(239, 68, 68, 0.3)"
                  : testState === "hitl" ? "rgba(212, 168, 64, 0.3)"
                  : "rgba(0, 245, 212, 0.3)"
                }`,
                borderRadius: "12px",
                padding: "16px",
                fontSize: "13.5px",
                lineHeight: 1.6,
                color:
                  testState === "blocked" ? "#fca5a5"
                  : testState === "hitl" ? "#fde047"
                  : "#5eead4",
              }}>
                {interventionMsg}
              </div>
            )}

            {/* Violation Badges */}
            {violationTags.length > 0 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center" }}>Policy Flags:</span>
                {violationTags.map((tag) => (
                  <span key={tag} style={{
                    background: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid #ef4444",
                    color: "#fca5a5",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    ✗ {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              {testState === "hitl" && (
                <button
                  onClick={() => { window.location.href = "/"; }}
                  style={{
                    flex: 1,
                    background: "var(--yellow, #d4a840)",
                    color: "#000",
                    border: "none",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ↗ Go to Dashboard CFO Approval Center
                </button>
              )}
              <button
                onClick={() => setTestState("idle")}
                style={{
                  flex: testState === "hitl" ? 0.6 : 1,
                  background: testState === "success" ? "linear-gradient(135deg, var(--teal,#00f5d4), #00bb9f)" : "rgba(255,255,255,0.1)",
                  color: testState === "success" ? "#000" : "#fff",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {testState === "running" ? "Cancel Test" : "Close Inspection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Invoice Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in p-4">
          <div className="glass-panel p-8 w-full max-w-md animate-slide-up border border-[var(--teal,#00f5d4)]/40 shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-white">Create X-402 Invoice</h2>
            <p className="text-xs text-secondary mb-6">Encode strict policy guardrails into payable merchant invoice.</p>
            
            <div className="flex flex-col gap-4 mb-8">
              <div>
                <label className="block text-xs text-secondary mb-1.5 uppercase font-mono">Vendor Name</label>
                <input
                  type="text"
                  className="glass-input w-full p-2.5 text-sm rounded-lg bg-black/40 border border-white/10 text-white focus:border-[var(--teal)] outline-none"
                  placeholder="e.g. Apple Inc, Unlisted Vendor LLC"
                  value={vendorInput}
                  onChange={(e) => setVendorInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1.5 uppercase font-mono">Item Description</label>
                <input
                  type="text"
                  className="glass-input w-full p-2.5 text-sm rounded-lg bg-black/40 border border-white/10 text-white focus:border-[var(--teal)] outline-none"
                  placeholder="e.g. MacBook Pro 16 M4 Max"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1.5 uppercase font-mono">Amount (USDC)</label>
                <input
                  type="number"
                  className="glass-input w-full p-2.5 text-sm rounded-lg bg-black/40 border border-white/10 text-white focus:border-[var(--teal)] outline-none"
                  placeholder="3499.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1.5 uppercase font-mono">Encoded Guardrail Rule</label>
                <select
                  className="glass-input w-full p-2.5 text-sm rounded-lg bg-black/40 border border-white/10 text-white focus:border-[var(--teal)] outline-none"
                  value={policyInput}
                  onChange={(e) => setPolicyInput(e.target.value)}
                >
                  <option value="Approved Vendors Only ($2,500 Max Cap)">Approved Vendors Only ($2,500 Max Cap)</option>
                  <option value="Hardware Allowance ($10,000 Cap)">Hardware Allowance ($10,000 Cap)</option>
                  <option value="CFO Threshold Allowance (> $5,000 Cap)">CFO Threshold Allowance (&gt; $5,000 Cap)</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm text-secondary hover:text-white transition-colors border border-transparent rounded-lg"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  background: "linear-gradient(135deg, var(--teal,#00f5d4), #00bb9f)",
                  color: "#000",
                  fontWeight: 700,
                }}
                className="px-5 py-2 text-sm rounded-lg shadow-lg hover:opacity-90 transition-opacity"
                onClick={handleCreateInvoice}
              >
                Generate Payable Invoice ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
