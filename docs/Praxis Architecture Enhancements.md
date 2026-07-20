# Praxis MVP Architecture — Enhancements

These sections fill in the gaps left unspecified in the main architecture plan.
Insert them into the corresponding numbered sections of the original document.

---

## Enhancement to Section 3 — Add to Core MVP Components table

| Component | Purpose | Owner |
|---|---|---|
| Shared TypeScript Types | `PurchaseIntent`, `VendorQuote`, `ProofOfReasoning`, `PaymentIntent`, `PaymentReceipt`, `ChainAnchor` — locked in hour 0 | All devs |
| Payment Executor | Single entry point that reads `PAYMENT_MODE` and routes to mock, hybrid, or x402 | Dev 2 |
| Chain Executor | Single entry point that reads `CHAIN_MODE` and routes to mock, local, or base-sepolia | Dev 2 |
| Seed Script | `prisma/seed.ts` — populates a complete demo run so Dev 3 can build UI immediately | Dev 2 |

---

## New Section: Shared TypeScript Types (Hour 0 Contract)

All three developers must agree on and freeze these types before splitting work.
**No inline type definitions. Everything goes through `src/types/`.**

```ts
// src/types/purchase.ts
export interface PurchaseIntent {
  runId: string;
  prompt: string;
  vendorName: string;
  itemDescription: string;
  quantity: number;
  unitPriceUsd: number;
  totalAmountUsd: number;
  currency: "USDC" | "USD";
  requestedAt: string; // ISO 8601
}

export interface VendorQuote {
  vendorName: string;
  itemDescription: string;
  quantity: number;
  unitPriceUsd: number;
  totalAmountUsd: number;
  quoteId: string;
  validUntil: string;
  paymentAddress: string; // EVM address
}
```

```ts
// src/types/proof.ts
import { PurchaseIntent, VendorQuote } from "./purchase";

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
  agentSummary: string;   // LLM-generated narrative, max 500 chars
  generatedAt: string;    // ISO 8601
}

export type ProofHash = string; // 0x-prefixed hex SHA-256 of canonical JSON
```

```ts
// src/types/payment.ts
import { ProofHash } from "./proof";

export interface PaymentIntent {
  runId: string;
  proofHash: ProofHash;
  payerAddress: string;
  payeeAddress: string;
  tokenAddress: string;   // ERC-20 contract address
  amountUsdc: number;
  network: string;        // CAIP-2, e.g. "eip155:84532"
  createdAt: string;
}

export interface PaymentReceipt {
  runId: string;
  proofHash: ProofHash;
  mode: "mock" | "hybrid" | "x402";
  txHash: string | null;
  settledAt: string;
  amountUsdc: number;
  payeeAddress: string;
  x402PaymentHeader?: string;
}

export interface ChainAnchor {
  registryAddress: string;
  anchorTxHash: string;
  chainId: number;
  network: string;
  proofHash: ProofHash;
  eventName: "PraxisPaymentRecorded";
  anchoredAt: string;
}
```

**Proof hashing — canonical JSON:**

```ts
// src/proof/hash-proof.ts
import { createHash } from "crypto";
import { ProofOfReasoning, ProofHash } from "../types/proof";

export function hashProof(proof: ProofOfReasoning): ProofHash {
  // Sort keys for deterministic output
  const canonical = JSON.stringify(proof, Object.keys(proof).sort());
  const hash = createHash("sha256").update(canonical).digest("hex");
  return `0x${hash}`;
}
```

---

## Enhancement to Section 5 — HITL Pause/Resume (Full Specification)

The architecture doc mentions `POST /api/runs/:runId/approve` but does not specify when HITL triggers or how the workflow suspends and resumes.

### When HITL triggers

Controlled by `HITL_THRESHOLD_USDC` env var (default `0` = auto-approve everything, good for demo):

```txt
HITL_THRESHOLD_USDC=0       → all payments auto-approved (default, demo-safe)
HITL_THRESHOLD_USDC=500     → amounts > $500 USDC require human approval
HITL_THRESHOLD_USDC=99999   → only absurdly large amounts require approval
```

### Workflow side (Dev 1)

```ts
// src/mastra/workflows/purchase-workflow.ts — after policyGuard step

const hitlThreshold = parseFloat(process.env.HITL_THRESHOLD_USDC ?? "0");
const needsHitl = hitlThreshold > 0 && intent.totalAmountUsd > hitlThreshold;

if (needsHitl) {
  await runStore.setStatus(runId, "awaiting_approval");
  await runStore.addEvent(runId, {
    type: "hitl",
    label: "Awaiting human approval",
    status: "pending",
    payload: { amountUsdc: intent.totalAmountUsd, threshold: hitlThreshold },
  });
  // Return early — workflow does not proceed until /approve is called
  return { status: "awaiting_approval", runId };
}
// Otherwise fall through to payment firewall
```

### API side (Dev 2)

```ts
// app/api/runs/[runId]/approve/route.ts
import { runStore } from "@/src/store/run-store";
import { resumePurchaseWorkflow } from "@/src/mastra/workflows/purchase-workflow";

export async function POST(req: Request, { params }: { params: { runId: string } }) {
  const { approved }: { approved: boolean } = await req.json();
  const run = await runStore.getById(params.runId);

  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "awaiting_approval") {
    return Response.json({ error: "Run is not awaiting approval" }, { status: 400 });
  }

  if (!approved) {
    await runStore.setStatus(params.runId, "rejected_by_human");
    await runStore.addEvent(params.runId, {
      type: "hitl",
      label: "Payment rejected by human",
      status: "rejected",
      payload: {},
    });
    return Response.json({ status: "rejected" });
  }

  await runStore.setStatus(params.runId, "approved_by_human");
  await runStore.addEvent(params.runId, {
    type: "hitl",
    label: "Payment approved by human",
    status: "success",
    payload: {},
  });

  // Resume workflow from the payment firewall step
  const result = await resumePurchaseWorkflow(params.runId);
  return Response.json(result);
}
```

### Dashboard side (Dev 3)

```tsx
// components/approval-modal.tsx
// - Poll GET /api/runs/:runId every 2000ms
// - When run.status === "awaiting_approval", show modal overlay
// - Modal shows: vendor name, amount, proof hash, agent summary
// - "Approve" → POST /api/runs/:runId/approve { approved: true }
// - "Reject"  → POST /api/runs/:runId/approve { approved: false }
// - After response, stop polling and refresh timeline
```

Run status state machine:

```
running
  → awaiting_approval   (HITL triggered)
      → approved_by_human → running → completed
      → rejected_by_human
  → completed
  → failed
```

---

## Enhancement to Section 6 — Blockchain Fallback Strategy

Add this to Section 6.6 (Blockchain Integration Flow).

Every call to the registry contract must have a timeout and fallback so a flaky Base Sepolia RPC never crashes the demo.

```ts
// src/blockchain/registry-client.ts
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { PaymentIntent, ChainAnchor } from "../types/payment";
import { ProofOfReasoning } from "../types/proof";

const REGISTRY_ABI = parseAbi([
  "function recordPayment(string runId, bytes32 proofHash, address payer, address payee, address token, uint256 amount) external",
  "event PraxisPaymentRecorded(string indexed runId, bytes32 indexed proofHash, address indexed payee, address payer, address token, uint256 amount, uint256 timestamp)",
]);

const RPC_TIMEOUT_MS = 8000;

export async function anchorPayment(
  intent: PaymentIntent,
  _proof: ProofOfReasoning
): Promise<ChainAnchor> {
  if (process.env.CHAIN_MODE === "mock") {
    return buildMockAnchor(intent);
  }

  try {
    const result = await Promise.race([
      _callRegistry(intent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC_TIMEOUT")), RPC_TIMEOUT_MS)
      ),
    ]);
    return result;
  } catch (err) {
    // Log failure but never crash — fall back to mock anchor so demo keeps running
    console.warn("[registry-client] On-chain anchor failed, using mock fallback:", err);
    return buildMockAnchor(intent, { fallback: true, reason: String(err) });
  }
}

async function _callRegistry(intent: PaymentIntent): Promise<ChainAnchor> {
  const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  const hash = await walletClient.writeContract({
    address: process.env.PRAXIS_REGISTRY_ADDRESS as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "recordPayment",
    args: [
      intent.runId,
      intent.proofHash as `0x${string}`,
      intent.payerAddress as `0x${string}`,
      intent.payeeAddress as `0x${string}`,
      intent.tokenAddress as `0x${string}`,
      BigInt(Math.round(intent.amountUsdc * 1e6)), // USDC has 6 decimals
    ],
  });

  return {
    registryAddress: process.env.PRAXIS_REGISTRY_ADDRESS!,
    anchorTxHash: hash,
    chainId: 84532,
    network: "base-sepolia",
    proofHash: intent.proofHash,
    eventName: "PraxisPaymentRecorded",
    anchoredAt: new Date().toISOString(),
  };
}

function buildMockAnchor(intent: PaymentIntent, meta?: object): ChainAnchor {
  return {
    registryAddress: process.env.PRAXIS_REGISTRY_ADDRESS ?? "0xMOCK_REGISTRY",
    anchorTxHash: `0xmock_anchor_${intent.proofHash.slice(2, 10)}_${Date.now().toString(16)}`,
    chainId: 84532,
    network: "base-sepolia",
    proofHash: intent.proofHash,
    eventName: "PraxisPaymentRecorded",
    anchoredAt: new Date().toISOString(),
    ...((meta as object) ?? {}),
  } as ChainAnchor;
}
```

---

## Enhancement to Section 7 — x402 Fallback Strategy

Add to Section 7.1 (x402 Flow).

```ts
// src/payment/x402-client.ts
import { PaymentIntent, PaymentReceipt } from "../types/payment";

const FACILITATOR_TIMEOUT_MS = 6000;

export async function executeX402Payment(intent: PaymentIntent): Promise<PaymentReceipt> {
  try {
    const receipt = await Promise.race([
      _callFacilitator(intent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FACILITATOR_TIMEOUT")), FACILITATOR_TIMEOUT_MS)
      ),
    ]);
    return receipt;
  } catch (err) {
    // Facilitator down or timed out — degrade gracefully to hybrid mode
    console.warn("[x402-client] Facilitator failed, using hybrid receipt:", err);
    return {
      runId: intent.runId,
      proofHash: intent.proofHash,
      mode: "hybrid",
      txHash: null,
      settledAt: new Date().toISOString(),
      amountUsdc: intent.amountUsdc,
      payeeAddress: intent.payeeAddress,
    };
  }
}

async function _callFacilitator(intent: PaymentIntent): Promise<PaymentReceipt> {
  const facilitatorUrl = process.env.FACILITATOR_URL;
  if (!facilitatorUrl) throw new Error("FACILITATOR_URL not set");

  // Step 1: Request protected resource → get 402
  const res402 = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vendor/protected-data`, {
    method: "GET",
  });

  if (res402.status !== 402) throw new Error(`Expected 402, got ${res402.status}`);

  const paymentRequired = await res402.json();

  // Step 2: Sign EIP-3009 authorization (simplified — use coinbase x402 SDK)
  // const { signPayment } = await import("x402");
  // const paymentHeader = await signPayment(paymentRequired, wallet);

  // Step 3: Retry with payment header
  // const paidRes = await fetch(url, { headers: { "X-Payment": paymentHeader } });

  // For now return a shaped receipt — replace with real SDK call
  return {
    runId: intent.runId,
    proofHash: intent.proofHash,
    mode: "x402",
    txHash: `0x_x402_${Date.now().toString(16)}`,
    settledAt: new Date().toISOString(),
    amountUsdc: intent.amountUsdc,
    payeeAddress: intent.payeeAddress,
  };
}
```

---

## Enhancement to Section 8 — run-store helpers (Dev 1 interface)

Dev 1 calls these helpers. Dev 2 implements them. They must be defined before Dev 1 starts writing workflow code.

```ts
// src/store/run-store.ts — interface contract
export interface RunEventInput {
  type: "workflow" | "guard" | "proof" | "payment" | "chain" | "hitl";
  label: string;
  status: "pending" | "success" | "failed" | "rejected";
  payload?: object;
}

export const runStore = {
  create: (runId: string, prompt: string) => Promise<void>,
  setStatus: (runId: string, status: string) => Promise<void>,
  addEvent: (runId: string, event: RunEventInput) => Promise<void>,
  setIntent: (runId: string, intent: PurchaseIntent) => Promise<void>,
  setQuote: (runId: string, quote: VendorQuote) => Promise<void>,
  setBudget: (runId: string, budget: BudgetDecision) => Promise<void>,
  setPolicy: (runId: string, policy: PolicyDecision) => Promise<void>,
  setProof: (runId: string, proof: ProofOfReasoning, hash: ProofHash) => Promise<void>,
  setPayment: (runId: string, receipt: PaymentReceipt) => Promise<void>,
  setChainAnchor: (runId: string, anchor: ChainAnchor) => Promise<void>,
  getById: (runId: string) => Promise<Run | null>,
};
```

Dev 1 imports only from `run-store.ts`. Dev 1 never imports Prisma directly.

---

## Enhancement to Section 10 — Seed Script (Move to Hour 0–2)

The original plan places seed script work in hour 20–24. **This is too late.**

Dev 2 must deliver a working `prisma/seed.ts` by hour 2 so Dev 3 can build the entire dashboard UI against realistic data without waiting for the full pipeline.

Seed data must include:
- One `completed` run with all JSON blobs populated
- One `awaiting_approval` run (so Dev 3 can build the approval modal)
- One `failed` run (so Dev 3 can build error states)
- At least 8 `RunEvent` rows per run covering all event types

Run with: `npx prisma db seed`

Revised hour 0–2 for Dev 2:

| Time | Dev 2 task |
|---|---|
| 0–0.5h | Prisma schema, `npx prisma migrate dev` |
| 0.5–1h | `run-store.ts` — implement all helpers |
| 1–2h | `prisma/seed.ts` — 3 complete demo runs |
| 2h | Unblock Dev 3: confirm seed works, share DB file |

---

## Enhancement to Section 12 — Updated 24-Hour Execution Plan

| Time | Dev 1 | Dev 2 | Dev 3 |
|---|---|---|---|
| 0–0.5h | **Type contract meeting** — agree and commit `src/types/**` | **Type contract meeting** — same | **Type contract meeting** — same |
| 0.5–2h | Mastra setup, prompt parser skeleton | Prisma schema, run-store helpers, **seed script** | Dashboard layout wired to seed data |
| 2–6h | Budget guard, policy guard, proof builder | API routes, mock vendor quote, compile registry contract | Timeline component, quote card, policy card |
| 6–10h | Mastra workflow integration, proof hashing | Payment firewall, mock payment executor, deploy registry locally | Connect UI to real API, proof viewer |
| 10–14h | HITL conditions, over-budget/bad-vendor edge cases | x402 client + fallback, Base Sepolia deploy, registry anchor | Payment card, chain anchor card, BaseScan links |
| 14–18h | Proof summary quality, agent narrative polish | Stabilize mock/hybrid/x402 mode switching | Approval modal, HITL UI, animated timeline |
| 18–22h | Edge case testing with Dev 2 | Final fallback mode hardening, DB demo seed refresh | Error states, demo mode badge, loading skeletons |
| 22–24h | Bug fixes and pitch support | Confirm all CHAIN_MODE + PAYMENT_MODE combos work | Demo polish, rehearse flow, backup screenshots |

---

## Enhancement to Section 9 — Complete `.env.example`

```bash
# ─── App ────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ─── Mode flags (change these to upgrade integrations) ──
# mock | hybrid | x402
PAYMENT_MODE=mock
# mock | local | base-sepolia
CHAIN_MODE=mock
# 0 = auto-approve all payments; set > 0 to trigger HITL above threshold
HITL_THRESHOLD_USDC=0

# ─── Database ───────────────────────────────────────
DATABASE_URL="file:./dev.db"

# ─── LLM ────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ─── Policy limits ──────────────────────────────────
# Max single payment the agent can authorize (USD)
AGENT_MAX_PAYMENT_USDC=1000
# Daily total budget across all agent payments (USD)
TENANT_DAILY_BUDGET_USD=100000

# ─── x402 (required for PAYMENT_MODE=x402) ──────────
FACILITATOR_URL=https://x402.org/facilitator
X402_NETWORK=eip155:84532
VENDOR_RECEIVER_ADDRESS=0x...
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# ─── Blockchain (required for CHAIN_MODE=base-sepolia) ──
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532
AGENT_PRIVATE_KEY=0x...
PRAXIS_REGISTRY_ADDRESS=0x...   # filled after deploy

# ─── Coinbase CDP (optional, only for PAYMENT_MODE=x402 with CDP wallet) ──
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
```

---

## Summary of What Was Enhanced

| Gap in original doc | Enhancement added |
|---|---|
| No TypeScript type definitions | Full `PurchaseIntent`, `VendorQuote`, `ProofOfReasoning`, `PaymentIntent`, `PaymentReceipt`, `ChainAnchor` interfaces |
| Proof hashing unspecified | `hashProof()` — canonical JSON + SHA-256, 0x-prefixed |
| HITL flow vague | Full trigger logic, workflow suspend/resume, API handler, dashboard polling pattern, run status state machine |
| No RPC fallback | `registry-client.ts` with `Promise.race` timeout and mock fallback |
| No x402 fallback | `x402-client.ts` with facilitator timeout and hybrid mode degradation |
| No run-store interface contract | Full `runStore` API that Dev 1 depends on and Dev 2 implements |
| Seed script placed at hour 20–24 | Moved to hour 0–2; seed data covers completed, awaiting\_approval, and failed runs |
| `.env.example` missing defaults and comments | Full annotated `.env.example` with section groupings and type hints |
| 24h plan had no hour-0 sync | Added type contract meeting as first 30 minutes for all three devs |
