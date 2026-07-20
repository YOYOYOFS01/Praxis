import type { PurchaseIntent, VendorQuote } from "./purchase";

export interface BudgetDecision {
  approved: boolean;
  remainingBudgetUsd: number;
  reason: string;
}

export interface PolicyDecision {
  approved: boolean;
  violatedPolicies: string[];
  reason: string;
}

export interface ProofOfReasoning {
  runId: string;
  intent: PurchaseIntent;
  quote: VendorQuote;
  budgetDecision: BudgetDecision;
  policyDecision: PolicyDecision;
  agentSummary: string; // LLM-generated narrative, max 500 chars
  generatedAt: string;  // ISO 8601
}

// 0x-prefixed hex SHA-256 of canonical JSON
export type ProofHash = string;
