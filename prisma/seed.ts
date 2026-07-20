import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const s = (v: unknown) => JSON.stringify(v);

async function main() {
  // ── Run 1: completed ──────────────────────────────────────────────────────
  await prisma.run.upsert({
    where: { id: "seed-run-001" },
    update: {},
    create: {
      id: "seed-run-001",
      status: "completed",
      prompt: "Order 5 units of Dell XPS 15 from TechVendor Inc for the engineering team.",
      intentJson: s({ runId: "seed-run-001", vendorName: "TechVendor Inc", itemDescription: "Dell XPS 15 Laptop", quantity: 5, unitPriceUsd: 1800, totalAmountUsd: 9000, currency: "USDC", requestedAt: "2026-07-17T10:00:00Z", prompt: "Order 5 units of Dell XPS 15 from TechVendor Inc for the engineering team." }),
      quoteJson: s({ vendorName: "TechVendor Inc", itemDescription: "Dell XPS 15 Laptop", quantity: 5, unitPriceUsd: 1800, totalAmountUsd: 9000, quoteId: "QT-20260717-001", validUntil: "2026-07-18T10:00:00Z", paymentAddress: "0x0000000000000000000000000000000000000001" }),
      budgetJson: s({ approved: true, remainingBudgetUsd: 91000, reason: "Within daily budget." }),
      policyJson: s({ approved: true, violatedPolicies: [], reason: "Vendor is whitelisted." }),
      proofHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
      proofJson: s({ runId: "seed-run-001", agentSummary: "Procurement approved: 5x Dell XPS 15 from TechVendor Inc for $9,000 USDC — within budget and vendor is whitelisted.", generatedAt: "2026-07-17T10:00:05Z" }),
      receiptJson: s({ runId: "seed-run-001", proofHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1", mode: "mock", txHash: "0xmock_payment_tx_hash_0000000001", settledAt: "2026-07-17T10:00:07Z", amountUsdc: 9000, payeeAddress: "0x0000000000000000000000000000000000000001" }),
      chainAnchorJson: s({ registryAddress: "0xMOCK_REGISTRY_0000000000000000000000001", anchorTxHash: "0xmock_anchor_abc123_191b3a", chainId: 84532, network: "base-sepolia", proofHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1", eventName: "PraxisPaymentRecorded", anchoredAt: "2026-07-17T10:00:09Z" }),
      events: {
        create: [
          { type: "workflow", label: "Intent parsed",             status: "success", payload: s({}) },
          { type: "workflow", label: "Vendor quote fetched",      status: "success", payload: s({}) },
          { type: "guard",    label: "Budget guard passed",       status: "success", payload: s({ approved: true }) },
          { type: "guard",    label: "Policy guard passed",       status: "success", payload: s({ approved: true }) },
          { type: "proof",    label: "Proof of Reasoning built",  status: "success", payload: s({}) },
          { type: "payment",  label: "Payment firewall passed",   status: "success", payload: s({}) },
          { type: "payment",  label: "Mock payment executed",     status: "success", payload: s({}) },
          { type: "chain",    label: "Proof anchored on-chain",   status: "success", payload: s({}) },
        ],
      },
    },
  });

  // ── Run 2: awaiting_approval (HITL demo) ──────────────────────────────────
  await prisma.run.upsert({
    where: { id: "seed-run-002" },
    update: {},
    create: {
      id: "seed-run-002",
      status: "awaiting_approval",
      prompt: "Purchase 20 MacBook Pro M3 Max units for the sales team — urgent.",
      intentJson: s({ runId: "seed-run-002", vendorName: "Apple Business Store", itemDescription: "MacBook Pro M3 Max 16-inch", quantity: 20, unitPriceUsd: 3499, totalAmountUsd: 69980, currency: "USDC", requestedAt: "2026-07-17T11:30:00Z", prompt: "Purchase 20 MacBook Pro M3 Max units for the sales team — urgent." }),
      quoteJson: s({ vendorName: "Apple Business Store", itemDescription: "MacBook Pro M3 Max 16-inch", quantity: 20, unitPriceUsd: 3499, totalAmountUsd: 69980, quoteId: "QT-20260717-002", validUntil: "2026-07-18T11:30:00Z", paymentAddress: "0x0000000000000000000000000000000000000002" }),
      budgetJson: s({ approved: true, remainingBudgetUsd: 30020, reason: "Within daily budget but exceeds single-payment threshold." }),
      policyJson: s({ approved: true, violatedPolicies: [], reason: "Vendor is approved." }),
      events: {
        create: [
          { type: "workflow", label: "Intent parsed",           status: "success",  payload: s({}) },
          { type: "workflow", label: "Vendor quote fetched",    status: "success",  payload: s({}) },
          { type: "guard",    label: "Budget guard passed",     status: "success",  payload: s({ approved: true }) },
          { type: "guard",    label: "Policy guard passed",     status: "success",  payload: s({ approved: true }) },
          { type: "hitl",     label: "Awaiting human approval", status: "pending",  payload: s({ amountUsdc: 69980, threshold: 10000 }) },
        ],
      },
    },
  });

  // ── Run 3: failed (budget exceeded + bad vendor) ──────────────────────────
  await prisma.run.upsert({
    where: { id: "seed-run-003" },
    update: {},
    create: {
      id: "seed-run-003",
      status: "failed",
      prompt: "Buy 500 gaming chairs from UnknownVendor LLC.",
      intentJson: s({ runId: "seed-run-003", vendorName: "UnknownVendor LLC", itemDescription: "Gaming Chair Pro", quantity: 500, unitPriceUsd: 800, totalAmountUsd: 400000, currency: "USDC", requestedAt: "2026-07-17T12:00:00Z", prompt: "Buy 500 gaming chairs from UnknownVendor LLC." }),
      quoteJson: s({ vendorName: "UnknownVendor LLC", itemDescription: "Gaming Chair Pro", quantity: 500, unitPriceUsd: 800, totalAmountUsd: 400000, quoteId: "QT-20260717-003", validUntil: "2026-07-18T12:00:00Z", paymentAddress: "0x0000000000000000000000000000000000000003" }),
      budgetJson: s({ approved: false, remainingBudgetUsd: 100000, reason: "Amount $400,000 exceeds daily budget of $100,000." }),
      policyJson: s({ approved: false, violatedPolicies: ["VENDOR_NOT_WHITELISTED", "EXCEEDS_SINGLE_PAYMENT_LIMIT"], reason: "Vendor not in approved list." }),
      events: {
        create: [
          { type: "workflow", label: "Intent parsed",               status: "success", payload: s({}) },
          { type: "workflow", label: "Vendor quote fetched",        status: "success", payload: s({}) },
          { type: "guard",    label: "Budget guard FAILED",         status: "failed",  payload: s({ approved: false, reason: "Exceeds daily budget" }) },
          { type: "guard",    label: "Policy guard FAILED",         status: "failed",  payload: s({ approved: false, violations: ["VENDOR_NOT_WHITELISTED"] }) },
          { type: "payment",  label: "Payment firewall BLOCKED",    status: "failed",  payload: s({ reason: "Guards did not pass" }) },
        ],
      },
    },
  });

  console.log("✅ Seed complete — 3 runs created (completed, awaiting_approval, failed)");
}

main().catch(console.error).finally(() => prisma.$disconnect());
