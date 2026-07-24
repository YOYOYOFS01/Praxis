import { mastra } from "@/src/mastra/index";
import { runStore } from "@/src/store/run-store";
import { executePayment } from "@/src/payment/payment-executor";
import { anchorPayment } from "@/src/blockchain/registry-client";
import { hashProof } from "@/src/proof/hash-proof";
import { runBudgetGuard } from "@/src/policy/budget-guard";
import { runPolicyGuard } from "@/src/policy/policy-guard";
import { logger } from "@/src/lib/security/logger";
import type { PurchaseIntent, VendorQuote } from "@/src/types/purchase";
import type { BudgetDecision, PolicyDecision, ProofOfReasoning } from "@/src/types/proof";
import type { PaymentIntent } from "@/src/types/payment";

export interface WorkflowResult {
  status: string;
  runId: string;
  run?: Awaited<ReturnType<typeof runStore.getById>>;
}

// ─── JSON extraction helper ──────────────────────────────────────────────────
function extractJson<T>(text: string, fallback: T): T {
  const candidates = [
    text.trim(),
    (text.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? [])[1] ?? "",
    (text.match(/\{[\s\S]+\}/) ?? [])[0] ?? "",
  ];
  for (const src of candidates) {
    if (!src) continue;
    try { return JSON.parse(src) as T; } catch { /* try next */ }
  }
  console.warn("[purchase-workflow] Could not parse agent JSON, using fallback.\nRaw:", text.slice(0, 100));
  return fallback;
}

// ─── Mock agent bypass (MOCK_AGENTS=true or no OPENAI_API_KEY) ───────────────
// Lets the full workflow run end-to-end in demo/hackathon mode without any LLM key.
function isMockMode() {
  return process.env.MOCK_AGENTS === "true" || !process.env.OPENAI_API_KEY;
}

/** Known item → typical unit price so prompts work without an explicit price */
const PRICE_HINTS: Array<{ pattern: RegExp; price: number }> = [
  { pattern: /macbook\s+pro/i,   price: 3499 },
  { pattern: /macbook\s+air/i,   price: 1299 },
  { pattern: /macbook/i,         price: 1999 },
  { pattern: /dell\s+xps/i,      price: 1800 },
  { pattern: /iphone/i,          price: 999  },
  { pattern: /ipad/i,            price: 799  },
  { pattern: /monitor/i,         price: 450  },
  { pattern: /gaming\s+chair/i,  price: 400  },
  { pattern: /keyboard/i,        price: 150  },
  { pattern: /headphones?/i,     price: 299  },
  { pattern: /desk/i,            price: 600  },
  { pattern: /server/i,          price: 5000 },
  { pattern: /laptop/i,          price: 1200 },
  { pattern: /ps5|playstation/i, price: 499  },
  { pattern: /xbox/i,            price: 499  },
  { pattern: /mouse/i,           price: 80   },
];

function lookupPrice(text: string): number {
  for (const { pattern, price } of PRICE_HINTS) {
    if (pattern.test(text)) return price;
  }
  return 299.99;
}

/** Parse vendor / item / quantity / price from a prompt string */
function mockParseIntent(runId: string, prompt: string): PurchaseIntent & {
  quoteId: string; validUntil: string; paymentAddress: string;
} {
  // Quantity — only match after an action verb to avoid matching model numbers
  const qtyMatch =
    prompt.match(/(?:order|buy|purchase)\s+(\d{1,4})\b/i) ??
    prompt.match(/\b(\d{1,4})\s+units?\b/i);
  const qty = Math.min(parseInt(qtyMatch?.[1] ?? "1", 10), 10_000);

  // Vendor — text after "from" up to "for", "at", punctuation, or end
  const vendorMatch = prompt.match(
    /\bfrom\s+((?:[A-Z][a-zA-Z0-9&.']*\s*){1,5})(?=\s+for|\s+at|\s+—|[.,]|$)/
  ) ?? prompt.match(/\bfrom\s+([\w][\w\s&.'"-]{1,50?})(?=\s+for|\s+at|\s+—|[.,]|\s*$)/i);
  const vendor = (vendorMatch?.[1] ?? "Mock Vendor").trim();

  // Item — text between action+qty and "from"
  const itemMatch = prompt.match(
    /(?:order|buy|purchase)\s+\d+\s+(?:units?\s+of\s+)?([\w][\w\s-]{2,80})(?=\s+from|\s+at|\s+for|$)/i
  );
  const item = (itemMatch?.[1] ?? prompt.slice(0, 80)).trim();

  // Price — only match if explicitly marked with $ or a unit keyword
  // Deliberately NOT matching bare numbers to avoid "XPS 15" → $15
  const priceMatch =
    prompt.match(/\$\s*([\d]{1,7}(?:,[\d]{3})*(?:\.\d{1,2})?)/i) ??
    prompt.match(/([\d]{1,7}(?:,[\d]{3})*(?:\.\d{1,2})?)\s*(?:usd|usdc|each|per\s+unit)\b/i);

  const unitPrice = priceMatch
    ? parseFloat(priceMatch[1].replace(/,/g, ""))
    : lookupPrice(item.length > 3 ? item : prompt);

  return {
    runId, prompt,
    vendorName:      vendor,
    itemDescription: item,
    quantity:        qty,
    unitPriceUsd:    unitPrice,
    totalAmountUsd:  Math.round(qty * unitPrice * 100) / 100,
    currency:        "USDC",
    requestedAt:     new Date().toISOString(),
    quoteId:         `QT-MOCK-${Date.now()}`,
    validUntil:      new Date(Date.now() + 86_400_000).toISOString(),
    paymentAddress:  process.env.VENDOR_RECEIVER_ADDRESS ?? "0x0000000000000000000000000000000000000001",
  };
}

// ─── Main workflow ───────────────────────────────────────────────────────────
/**
 * Implements the exact sequence diagram:
 *
 * POST /api/purchase
 *  → createRun                       [SQLite DB]
 *  → procurement-agent               → event intent_parsed + save intentJson
 *                                    → event vendor_quote_received + save quoteJson
 *  → guard-agent (parallel tools)    → event budget_check + save budgetJson
 *                                    → event policy_check + save policyJson
 *  → proof-agent                     → event proof_generated + save proofJson + proofHash
 *  → [HITL pause if threshold]
 *  → paymentFirewall (deterministic)
 *  → executePayment                  → event payment_settled + save receiptJson
 *  → anchorOnChain                   → save chainAnchorJson
 *  → getRun(runId) → return full run
 */
export async function runPurchaseWorkflow(
  runId: string,
  prompt: string,
  tenantId?: string | null
): Promise<WorkflowResult> {
  // Build a RequestContext so agents can read runId, modelSelection, etc.
  const ctx = new Map<string, unknown>([
    ["runId", runId],
    ["tenantId", tenantId ?? null],
    ["modelSelection", process.env.OPENAI_MODEL ?? "gpt-4o-mini"],
  ]);

  try {
    // ── Step 1 & 2: Procurement agent ─────────────────────────────────────
    let procData: {
      vendorName: string; itemDescription: string; quantity: number;
      unitPriceUsd: number; totalAmountUsd: number; currency: "USDC" | "USD";
      quoteId: string; validUntil: string; paymentAddress: string;
    };

    if (isMockMode()) {
      procData = mockParseIntent(runId, prompt);
    } else {
      const procAgent = mastra.getAgent("procurement-agent");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const procResp = await (procAgent as any).generate(
        [{ role: "user", content: `Parse and quote this procurement request:\n\n"${prompt}"` }],
        { requestContext: ctx }
      );
      procData = extractJson(procResp.text, mockParseIntent(runId, prompt));
    }

    const intent: PurchaseIntent = {
      runId, prompt,
      vendorName:      procData.vendorName,
      itemDescription: procData.itemDescription,
      quantity:        procData.quantity,
      unitPriceUsd:    procData.unitPriceUsd,
      totalAmountUsd:  procData.totalAmountUsd ?? procData.quantity * procData.unitPriceUsd,
      currency:        procData.currency ?? "USDC",
      requestedAt:     new Date().toISOString(),
    };

    const quote: VendorQuote = {
      vendorName:      procData.vendorName,
      itemDescription: procData.itemDescription,
      quantity:        procData.quantity,
      unitPriceUsd:    procData.unitPriceUsd,
      totalAmountUsd:  procData.totalAmountUsd ?? procData.quantity * procData.unitPriceUsd,
      quoteId:         procData.quoteId,
      validUntil:      procData.validUntil,
      paymentAddress:  procData.paymentAddress,
    };

    await runStore.setIntent(runId, intent);
    await runStore.addEvent(runId, {
      type: "workflow", label: "Intent parsed", status: "success",
      payload: { vendorName: intent.vendorName, totalAmountUsd: intent.totalAmountUsd },
    });

    await runStore.setQuote(runId, quote);
    await runStore.addEvent(runId, {
      type: "workflow", label: "Vendor quote fetched", status: "success",
      payload: { quoteId: quote.quoteId, totalAmountUsd: quote.totalAmountUsd },
    });

    // ── Steps 3 & 4: Guard agent (runs both guards in parallel) ────────────
    let budgetDecision: BudgetDecision;
    let policyDecision: PolicyDecision;

    if (isMockMode()) {
      budgetDecision = await runBudgetGuard(intent, tenantId);
      policyDecision = await runPolicyGuard(intent, quote, tenantId);
    } else {
      const gAgent = mastra.getAgent("guard-agent");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const guardResp = await (gAgent as any).generate(
        [{
          role: "user",
          content: `Run both guards IN PARALLEL for this purchase:\n\nIntent: ${JSON.stringify(intent)}\nQuote: ${JSON.stringify(quote)}`,
        }],
        { requestContext: ctx }
      );
      type GuardResult = { budgetDecision: BudgetDecision; policyDecision: PolicyDecision };
      const guardData = extractJson<GuardResult>(guardResp.text, {
        budgetDecision: { approved: false, remainingBudgetUsd: 0, reason: "Guard response parse failed" },
        policyDecision: { approved: false, violatedPolicies: ["GUARD_PARSE_ERROR"], reason: "Guard response parse failed" },
      });
      budgetDecision = guardData.budgetDecision;
      policyDecision = guardData.policyDecision;
    }

    await runStore.setBudget(runId, budgetDecision);
    await runStore.addEvent(runId, {
      type: "guard",
      label: budgetDecision.approved ? "Budget guard passed" : "Budget guard FAILED",
      status: budgetDecision.approved ? "success" : "failed",
      payload: { approved: budgetDecision.approved, reason: budgetDecision.reason },
    });

    await runStore.setPolicy(runId, policyDecision);
    await runStore.addEvent(runId, {
      type: "guard",
      label: policyDecision.approved ? "Policy guard passed" : "Policy guard FAILED",
      status: policyDecision.approved ? "success" : "failed",
      payload: { approved: policyDecision.approved, violations: policyDecision.violatedPolicies },
    });

    if (!budgetDecision.approved || !policyDecision.approved) {
      await runStore.addEvent(runId, {
        type: "payment", label: "Payment firewall BLOCKED — guards failed", status: "failed",
        payload: { budgetReason: budgetDecision.reason, policyViolations: policyDecision.violatedPolicies },
      });
      await runStore.setStatus(runId, "failed");
      return { status: "failed", runId, run: await runStore.getById(runId) };
    }

    // ── Step 5: Proof agent ────────────────────────────────────────────────
    let proof: ProofOfReasoning;

    const fallbackSummary = budgetDecision.approved && policyDecision.approved
      ? `Procurement approved: ${intent.quantity}x ${intent.itemDescription} from ${intent.vendorName} for $${intent.totalAmountUsd.toLocaleString()} USDC — within budget and vendor is whitelisted.`
      : `Procurement BLOCKED: ${intent.quantity}x ${intent.itemDescription} from ${intent.vendorName} — guards failed.`;

    const fallbackProof: ProofOfReasoning = {
      runId, intent, quote, budgetDecision, policyDecision,
      agentSummary: fallbackSummary,
      generatedAt: new Date().toISOString(),
    };

    if (isMockMode()) {
      proof = fallbackProof;
    } else {
      const pAgent = mastra.getAgent("proof-agent");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proofResp = await (pAgent as any).generate(
        [{
          role: "user",
          content: `Build the Proof-of-Reasoning for this procurement.\n\nIntent: ${JSON.stringify(intent)}\nQuote: ${JSON.stringify(quote)}\nBudget: ${JSON.stringify(budgetDecision)}\nPolicy: ${JSON.stringify(policyDecision)}`,
        }],
        { requestContext: ctx }
      );
      type ProofResult = { proof: ProofOfReasoning; proofHash: string };
      const proofData = extractJson<ProofResult>(proofResp.text, { proof: fallbackProof, proofHash: "" });
      proof = proofData.proof ?? fallbackProof;
    }

    // Always recompute hash server-side — never trust an agent-provided hash
    const proofHash = hashProof(proof);

    await runStore.setProof(runId, proof, proofHash);
    await runStore.addEvent(runId, {
      type: "proof", label: "Proof of Reasoning built", status: "success",
      payload: { proofHash, agentSummary: proof.agentSummary },
    });

    // ── HITL check ────────────────────────────────────────────────────────
    const hitlThreshold = parseFloat(process.env.HITL_THRESHOLD_USDC ?? "0");
    if (hitlThreshold > 0 && intent.totalAmountUsd > hitlThreshold) {
      await runStore.addEvent(runId, {
        type: "hitl", label: "Awaiting human approval", status: "pending",
        payload: { amountUsdc: intent.totalAmountUsd, threshold: hitlThreshold },
      });
      await runStore.setStatus(runId, "awaiting_approval");
      return { status: "awaiting_approval", runId };
    }

    // ── Steps 6–8: Firewall → Payment → Anchor ────────────────────────────
    return _executeAndAnchor(runId, intent, quote, proof, proofHash);

  } catch (err) {
    logger.error("purchase-workflow", "Unexpected error", err);
    try {
      await runStore.addEvent(runId, {
        type: "workflow", label: "Workflow error", status: "failed",
        payload: { error: String(err) },
      });
      await runStore.setStatus(runId, "failed");
    } catch { /* DB might be unavailable */ }
    return { status: "failed", runId, run: await runStore.getById(runId) };
  }
}

// ─── Resume after HITL approval ─────────────────────────────────────────────
export async function resumePurchaseWorkflow(runId: string): Promise<WorkflowResult> {
  const run = await runStore.getById(runId);
  if (!run) throw new Error(`Run ${runId} not found`);

  const proof     = run.proofJson   as unknown as ProofOfReasoning;
  const proofHash = run.proofHash!;
  const intent    = run.intentJson  as unknown as PurchaseIntent;
  const quote     = run.quoteJson   as unknown as VendorQuote;

  await runStore.setStatus(runId, "running");
  return _executeAndAnchor(runId, intent, quote, proof, proofHash);
}

// ─── Firewall → Payment → Chain Anchor (shared by normal + HITL resume) ─────
async function _executeAndAnchor(
  runId: string,
  intent: PurchaseIntent,
  quote: VendorQuote,
  proof: ProofOfReasoning,
  proofHash: string
): Promise<WorkflowResult> {
  const paymentIntent: PaymentIntent = {
    runId,
    proofHash,
    payerAddress: process.env.AGENT_WALLET_ADDRESS ?? "0xMOCK_PAYER_ADDRESS",
    payeeAddress: quote.paymentAddress,
    tokenAddress: process.env.USDC_TOKEN_ADDRESS ?? "0xMOCK_USDC",
    amountUsdc:   intent.totalAmountUsd,
    network:      process.env.X402_NETWORK ?? "eip155:84532",
    createdAt:    new Date().toISOString(),
  };

  // Execute payment — firewall is enforced inside executePayment before any payment mode
  const receipt = await executePayment(paymentIntent, proof);
  await runStore.setPayment(runId, receipt);
  await runStore.addEvent(runId, {
    type: "payment", label: `Payment executed (${receipt.mode})`, status: "success",
    payload: { txHash: receipt.txHash, mode: receipt.mode },
  });

  // Anchor on-chain
  const chainAnchor = await anchorPayment(paymentIntent, proof);
  await runStore.setChainAnchor(runId, chainAnchor);
  await runStore.addEvent(runId, {
    type: "chain", label: "Proof anchored on Base Sepolia", status: "success",
    payload: { anchorTxHash: chainAnchor.anchorTxHash, chainId: chainAnchor.chainId },
  });

  await runStore.setStatus(runId, "completed");
  return { status: "completed", runId, run: await runStore.getById(runId) };
}
