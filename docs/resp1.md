# Praxis Build Strategy — V1 Mock-First, Then Upgrade

Yes — that's the **best approach**.

Build **V1 as a fully working mock/hybrid app first**, with the same architecture as the final product, but without depending on real secrets or unstable external services.

---

## Recommended approach

### V1: Complete working demo without real keys

`.env` for V1:

```txt
PAYMENT_MODE=mock
CHAIN_MODE=mock
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

V1 must include all of these before any real key is added:

| Module | What it does in mock mode |
|---|---|
| Dashboard | Renders full UI from seeded SQLite data |
| SQLite + Prisma | Stores every run, event, proof, payment, anchor |
| Mastra workflow | Runs end-to-end with mock tool responses |
| Procurement agent | Parses intent via LLM, returns `PurchaseIntent` |
| Budget guard | Deterministic check — no LLM, no network |
| Policy guard | Deterministic check — no LLM, no network |
| Proof-of-Reasoning builder | Assembles and hashes proof object locally |
| Payment firewall | Validates `PaymentIntent` against proof |
| Mock x402 payment | Returns a fake receipt with realistic shape |
| Mock blockchain receipt | Returns a fake `anchorTxHash` and `chainId` |
| Seed script | Populates DB with a complete demo run |
| `.env.example` | Every key documented with type and default |

This gives you a stable app that **always works**, regardless of testnet status.

---

### Shared TypeScript Types — Lock These Down in Hour 0

All three developers must agree on these before splitting work.
Put them in `src/types/` and never let anyone redefine them inline.

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
export interface ProofOfReasoning {
  runId: string;
  intent: PurchaseIntent;
  quote: VendorQuote;
  budgetDecision: { approved: boolean; remainingBudgetUsd: number; reason: string };
  policyDecision: { approved: boolean; violatedPolicies: string[]; reason: string };
  agentSummary: string;        // LLM-generated narrative
  generatedAt: string;         // ISO 8601
}

export type ProofHash = string; // hex string, 0x-prefixed SHA-256 of canonical JSON
```

```ts
// src/types/payment.ts
export interface PaymentIntent {
  runId: string;
  proofHash: ProofHash;
  payerAddress: string;
  payeeAddress: string;
  tokenAddress: string;       // ERC-20 or zero address for native
  amountUsdc: number;
  network: string;            // e.g. "eip155:84532"
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
  x402PaymentHeader?: string; // raw header if real x402
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

---

### HITL (Human-in-the-Loop) Pause/Resume — Full Flow

This is the most integration-risky piece. Dev 1, Dev 2, and Dev 3 all touch it.

**When HITL triggers:**
- Budget guard passes but amount > `AGENT_MAX_PAYMENT_USDC` threshold
- Policy guard returns a soft warning (not a hard block)
- Configured via `HITL_THRESHOLD_USDC` env var (default: `0`, meaning always auto-approve)

**Mastra workflow side (Dev 1):**

```ts
// src/mastra/workflows/purchase-workflow.ts
// After policyGuard step, check if HITL is needed
const needsHitl =
  parseFloat(process.env.HITL_THRESHOLD_USDC ?? "0") > 0 &&
  intent.totalAmountUsd > parseFloat(process.env.HITL_THRESHOLD_USDC!);

if (needsHitl) {
  await runStore.setStatus(runId, "awaiting_approval");
  // Workflow suspends — Dev 2's approval route resumes it
  return { status: "awaiting_approval" };
}
```

**API side (Dev 2):**

```ts
// app/api/runs/[runId]/approve/route.ts
export async function POST(req: Request, { params }: { params: { runId: string } }) {
  const { approved } = await req.json();
  const run = await runStore.getById(params.runId);

  if (run.status !== "awaiting_approval") {
    return Response.json({ error: "Run is not awaiting approval" }, { status: 400 });
  }

  if (!approved) {
    await runStore.setStatus(params.runId, "rejected_by_human");
    return Response.json({ status: "rejected" });
  }

  await runStore.setStatus(params.runId, "approved_by_human");
  // Re-trigger the rest of the workflow from paymentFirewall step
  const result = await resumePurchaseWorkflow(params.runId);
  return Response.json(result);
}
```

**Dashboard side (Dev 3):**

```tsx
// components/approval-modal.tsx
// Poll GET /api/runs/:runId every 2s
// When status === "awaiting_approval", show modal
// Approve button → POST /api/runs/:runId/approve { approved: true }
// Reject button  → POST /api/runs/:runId/approve { approved: false }
```

---

### Base Sepolia RPC Fallback — Never Break the Demo

Wrap every on-chain call with a timeout and fallback to mock anchor:

```ts
// src/blockchain/registry-client.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const RPC_TIMEOUT_MS = 8000;

export async function anchorPayment(intent: PaymentIntent, proof: ProofOfReasoning): Promise<ChainAnchor> {
  if (process.env.CHAIN_MODE === "mock") {
    return buildMockAnchor(intent, proof);
  }

  try {
    const result = await Promise.race([
      callRegistryContract(intent, proof),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC_TIMEOUT")), RPC_TIMEOUT_MS)
      ),
    ]);
    return result;
  } catch (err) {
    console.warn("[registry-client] Chain call failed, falling back to mock anchor:", err);
    // Log the failure but never crash the demo
    return buildMockAnchor(intent, proof, { failed: true, reason: String(err) });
  }
}

function buildMockAnchor(
  intent: PaymentIntent,
  proof: ProofOfReasoning,
  meta?: { failed?: boolean; reason?: string }
): ChainAnchor {
  return {
    registryAddress: process.env.PRAXIS_REGISTRY_ADDRESS ?? "0xMOCK",
    anchorTxHash: `0xmock_${intent.proofHash.slice(2, 10)}`,
    chainId: 84532,
    network: "base-sepolia",
    proofHash: intent.proofHash,
    eventName: "PraxisPaymentRecorded",
    anchoredAt: new Date().toISOString(),
    ...(meta ?? {}),
  } as ChainAnchor;
}
```

---

### x402 Facilitator Fallback — Graceful Degradation

Never let a facilitator outage kill the demo. Wrap x402 calls with a timeout and fall back to hybrid mode:

```ts
// src/payment/x402-client.ts
const FACILITATOR_TIMEOUT_MS = 6000;

export async function executeX402Payment(intent: PaymentIntent): Promise<PaymentReceipt> {
  if (process.env.PAYMENT_MODE === "mock") {
    return buildMockReceipt(intent);
  }

  try {
    const receipt = await Promise.race([
      callX402Facilitator(intent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FACILITATOR_TIMEOUT")), FACILITATOR_TIMEOUT_MS)
      ),
    ]);
    return receipt;
  } catch (err) {
    console.warn("[x402-client] Facilitator unreachable, falling back to hybrid receipt:", err);
    // Hybrid: proof and anchor are real, settlement is mocked
    return buildMockReceipt(intent, { mode: "hybrid", fallbackReason: String(err) });
  }
}

function buildMockReceipt(
  intent: PaymentIntent,
  meta?: { mode?: "mock" | "hybrid"; fallbackReason?: string }
): PaymentReceipt {
  return {
    runId: intent.runId,
    proofHash: intent.proofHash,
    mode: meta?.mode ?? "mock",
    txHash: `0xmock_${Date.now().toString(16)}`,
    settledAt: new Date().toISOString(),
    amountUsdc: intent.amountUsdc,
    payeeAddress: intent.payeeAddress,
  };
}
```

---

### Seed Script — Run This Before Hour 2, Not Hour 20

Dev 2 should build this in the first 2 hours so Dev 3 can develop the UI against realistic data immediately.

```ts
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const runId = "seed-run-001";

  await prisma.run.upsert({
    where: { id: runId },
    update: {},
    create: {
      id: runId,
      status: "completed",
      prompt: "Order 5 units of Dell XPS 15 from TechVendor Inc for the engineering team.",
      intentJson: {
        runId,
        vendorName: "TechVendor Inc",
        itemDescription: "Dell XPS 15 Laptop",
        quantity: 5,
        unitPriceUsd: 1800,
        totalAmountUsd: 9000,
        currency: "USDC",
        requestedAt: "2026-07-17T10:00:00Z",
      },
      quoteJson: {
        vendorName: "TechVendor Inc",
        itemDescription: "Dell XPS 15 Laptop",
        quantity: 5,
        unitPriceUsd: 1800,
        totalAmountUsd: 9000,
        quoteId: "QT-20260717-001",
        validUntil: "2026-07-18T10:00:00Z",
        paymentAddress: "0xVendorMockAddress000000000000000000000001",
      },
      budgetJson: { approved: true, remainingBudgetUsd: 91000, reason: "Within daily budget." },
      policyJson: { approved: true, violatedPolicies: [], reason: "Vendor is whitelisted." },
      proofHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
      proofJson: {
        runId,
        agentSummary: "Procurement approved: 5x Dell XPS 15 from whitelisted vendor within budget.",
        generatedAt: "2026-07-17T10:00:05Z",
      },
      paymentJson: {
        mode: "mock",
        txHash: "0xmock_payment_tx_hash_0000000001",
        settledAt: "2026-07-17T10:00:07Z",
        amountUsdc: 9000,
      },
      chainAnchorJson: {
        registryAddress: "0xMOCK_REGISTRY",
        anchorTxHash: "0xmock_anchor_tx_hash_000000001",
        chainId: 84532,
        network: "base-sepolia",
        proofHash: "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
        eventName: "PraxisPaymentRecorded",
        anchoredAt: "2026-07-17T10:00:09Z",
      },
      events: {
        create: [
          { type: "workflow", label: "Intent parsed", status: "success", payload: {} },
          { type: "workflow", label: "Vendor quote fetched", status: "success", payload: {} },
          { type: "guard", label: "Budget guard", status: "success", payload: { approved: true } },
          { type: "guard", label: "Policy guard", status: "success", payload: { approved: true } },
          { type: "proof", label: "Proof of Reasoning built", status: "success", payload: {} },
          { type: "payment", label: "Payment firewall passed", status: "success", payload: {} },
          { type: "payment", label: "Mock payment executed", status: "success", payload: {} },
          { type: "chain", label: "Proof anchored on Base Sepolia", status: "success", payload: {} },
        ],
      },
    },
  });

  console.log("✅ Seed complete — run ID:", runId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts"
}
```

Run with: `npx prisma db seed`

---

### Env-Flag Switching — Implementation Pattern

The env flags must be checked in one place per module, not scattered across files.

```ts
// src/payment/payment-executor.ts
import { executeX402Payment } from "./x402-client";
import { buildMockReceipt } from "./mock-payment";

export async function executePayment(intent: PaymentIntent): Promise<PaymentReceipt> {
  const mode = process.env.PAYMENT_MODE ?? "mock";

  switch (mode) {
    case "x402":
      return executeX402Payment(intent);   // falls back to hybrid internally
    case "hybrid":
      // Real proof + anchor, mocked settlement
      return buildMockReceipt(intent, { mode: "hybrid" });
    case "mock":
    default:
      return buildMockReceipt(intent);
  }
}
```

```ts
// src/blockchain/chain-executor.ts
import { anchorPayment } from "./registry-client";

export async function anchorProof(intent: PaymentIntent, proof: ProofOfReasoning): Promise<ChainAnchor> {
  const mode = process.env.CHAIN_MODE ?? "mock";

  if (mode === "mock") {
    return buildMockAnchor(intent, proof);
  }
  // "local" or "base-sepolia" — both go through registry-client which has its own fallback
  return anchorPayment(intent, proof);
}
```

---

## Then continuously upgrade

After V1 is stable, add real integrations step by step.

### V1.1 — Real smart contract scaffold (local)

```txt
New files:
  contracts/PraxisPaymentRegistry.sol   ← already written in arch doc
  contracts/deploy.ts                   ← Hardhat or Foundry deploy script
  src/blockchain/deployments.ts         ← stores local contract address
  src/blockchain/registry-abi.ts        ← export contract ABI as const

New env:
  CHAIN_MODE=local
```

Deploy locally with:
```bash
npx hardhat node
npx hardhat run contracts/deploy.ts --network localhost
```

### V1.2 — Deploy to Base Sepolia

```txt
New env:
  CHAIN_MODE=base-sepolia
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
  BASE_SEPOLIA_CHAIN_ID=84532
  AGENT_PRIVATE_KEY=0x...
  PRAXIS_REGISTRY_ADDRESS=0x...   ← filled after deploy
```

Deploy with:
```bash
npx hardhat run contracts/deploy.ts --network base-sepolia
```

### V1.3 — Anchor proof hashes on-chain

`CHAIN_MODE=base-sepolia` activates `registry-client.ts` live path.

Dashboard now shows:
- Real `anchorTxHash`
- Live BaseScan link: `https://sepolia.basescan.org/tx/{anchorTxHash}`

### V1.4 — Real x402 client/server flow

```txt
New env:
  PAYMENT_MODE=x402
  FACILITATOR_URL=https://x402.org/facilitator
  X402_NETWORK=eip155:84532
  VENDOR_RECEIVER_ADDRESS=0x...
  USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

The `vendor/protected-data` route returns HTTP 402 with payment requirements.
The x402 client in `src/payment/x402-client.ts` handles the challenge.

### V1.5 — CDP wallet (only if needed)

```txt
New env:
  CDP_API_KEY_ID=...
  CDP_API_KEY_SECRET=...
  CDP_WALLET_SECRET=...
```

Replace `src/payment/wallet.ts` local signer with CDP MPC wallet. Only needed if managing testnet keys is painful.

---

## Important rule

Design every module so the real integration is a drop-in swap, not a rewrite.

```txt
PAYMENT_MODE=mock | hybrid | x402
CHAIN_MODE=mock | local | base-sepolia
HITL_THRESHOLD_USDC=0          (0 = auto-approve all)
```

This means:
- Demo never breaks
- All three devs can work in parallel from hour 0 using mock mode
- Real keys slot in without touching business logic
- Judges see the complete architecture even in mock mode
- If Base Sepolia or x402 goes down mid-demo, one env var fixes it

## Final answer

Complete a stable **V1 mock/hybrid app** first. Lock types in hour 0. Build the seed script in hour 2. Then replace mocked modules with real integrations using env flags — never by restructuring code.

That is the safest and most professional way to build this for a 24-hour hackathon.
