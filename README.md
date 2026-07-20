# Praxis — Agent Payment Firewall

Autonomous procurement agent with deterministic payment guardrails, persistent audit storage, x402-style payment handling, and Base Sepolia smart-contract proof anchoring.

---

## Quick Start (mock mode — no keys needed)

```bash
# 1. Install dependencies
npm install

# 2. Copy env and set up database
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init

# 3. Seed demo data (3 runs: completed, awaiting_approval, failed)
npm run db:seed

# 4. Start dev server
npm run dev
```

Open http://localhost:3000

---

## Upgrade Path

### Step 1 — Add your OpenAI key (enables real LLM intent parsing)
```env
OPENAI_API_KEY=sk-...
```

### Step 2 — Deploy registry to Base Sepolia
```bash
npx hardhat run contracts/deploy.ts --network base-sepolia
```
Then set:
```env
CHAIN_MODE=base-sepolia
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
AGENT_PRIVATE_KEY=0x...
PRAXIS_REGISTRY_ADDRESS=0x...   # from deploy output
```

### Step 3 — Enable real x402 payments
```env
PAYMENT_MODE=x402
FACILITATOR_URL=https://x402.org/facilitator
X402_NETWORK=eip155:84532
VENDOR_RECEIVER_ADDRESS=0x...
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Step 4 — Enable HITL approval threshold
```env
HITL_THRESHOLD_USDC=500   # payments > $500 USDC pause for human approval
```

---

## Architecture

```
User
 └─► Next.js Dashboard
      └─► POST /api/purchase
           └─► createRun(prompt)                    → SQLite DB
           └─► purchaseWorkflow(runId, prompt)
                ├─► parseIntent         (LLM)       → save intentJson
                ├─► fetchVendorQuote    (mock/API)  → save quoteJson
                ├─► budgetGuard         (deterministic) → save budgetJson
                ├─► policyGuard         (deterministic) → save policyJson
                ├─► buildProofOfReasoning            → save proofJson + proofHash
                ├─► [HITL pause if threshold exceeded]
                ├─► paymentFirewall     (deterministic)
                ├─► executePayment      (mock|hybrid|x402)  → save receiptJson
                └─► anchorOnChain       (mock|local|base-sepolia) → save chainAnchorJson
           └─► getRun(runId) → return full run to dashboard
```

### Security principle
> LLM proposes → Workflow structures → Guards validate → Firewall approves → Wallet signs → Blockchain anchors

LLM output **never** directly authorises a payment.

---

## Folder Structure

```
praxis-mvp/
├── contracts/
│   ├── PraxisPaymentRegistry.sol   # audit registry on Base Sepolia
│   └── PraxisDeferredEscrow.sol    # optional stretch contract
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                     # 3 demo runs (completed/awaiting/failed)
├── app/
│   ├── api/
│   │   ├── purchase/route.ts       # POST — start workflow
│   │   ├── runs/route.ts           # GET  — list all runs
│   │   ├── runs/[runId]/route.ts   # GET  — single run
│   │   ├── runs/[runId]/approve/route.ts  # POST — HITL approve/reject
│   │   ├── vendor/quote/route.ts          # GET  — mock free quote
│   │   └── vendor/protected-data/route.ts # GET  — x402 protected endpoint
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── chat-panel.tsx
│   ├── workflow-timeline.tsx
│   ├── vendor-quote-card.tsx
│   ├── policy-check-card.tsx
│   ├── proof-viewer.tsx
│   ├── payment-card.tsx
│   ├── chain-anchor-card.tsx
│   ├── approval-modal.tsx
│   └── demo-mode-badge.tsx
└── src/
    ├── types/
    │   ├── purchase.ts   # PurchaseIntent, VendorQuote
    │   ├── proof.ts      # ProofOfReasoning, BudgetDecision, PolicyDecision, ProofHash
    │   ├── payment.ts    # PaymentIntent, PaymentReceipt, ChainAnchor
    │   └── run.ts        # RunStatus, RunEventInput
    ├── db/prisma.ts
    ├── store/run-store.ts
    ├── proof/hash-proof.ts
    ├── policy/
    │   ├── budget-guard.ts
    │   └── policy-guard.ts
    ├── payment/
    │   ├── payment-firewall.ts
    │   ├── payment-executor.ts   # env-flag router: mock|hybrid|x402
    │   ├── mock-payment.ts
    │   └── x402-client.ts
    ├── blockchain/
    │   └── registry-client.ts    # env-flag router + RPC fallback
    └── mastra/
        ├── agents/procurement-agent.ts
        ├── tools/vendor-quote-tool.ts
        └── workflows/purchase-workflow.ts  # full sequence + HITL + resume
```

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/purchase` | Start a procurement run. Body: `{ prompt: string }` |
| GET  | `/api/runs` | List all runs (newest first) |
| GET  | `/api/runs/:runId` | Get full run with all events |
| POST | `/api/runs/:runId/approve` | HITL approve/reject. Body: `{ approved: boolean }` |
| GET  | `/api/vendor/quote` | Mock free vendor quote |
| GET  | `/api/vendor/protected-data` | x402 protected endpoint (returns 402 in x402 mode) |

---

## Environment Variables

| Variable | Default | Required for |
|----------|---------|-------------|
| `PAYMENT_MODE` | `mock` | Always |
| `CHAIN_MODE` | `mock` | Always |
| `HITL_THRESHOLD_USDC` | `0` | HITL feature |
| `DATABASE_URL` | `file:./dev.db` | Always |
| `OPENAI_API_KEY` | — | Real LLM parsing |
| `AGENT_MAX_PAYMENT_USDC` | `1000` | Budget guard |
| `TENANT_DAILY_BUDGET_USD` | `100000` | Budget guard |
| `FACILITATOR_URL` | — | `PAYMENT_MODE=x402` |
| `X402_NETWORK` | — | `PAYMENT_MODE=x402` |
| `VENDOR_RECEIVER_ADDRESS` | — | `PAYMENT_MODE=x402` |
| `USDC_TOKEN_ADDRESS` | — | `PAYMENT_MODE=x402` |
| `BASE_SEPOLIA_RPC_URL` | — | `CHAIN_MODE=base-sepolia` |
| `AGENT_PRIVATE_KEY` | — | `CHAIN_MODE=base-sepolia` |
| `PRAXIS_REGISTRY_ADDRESS` | — | `CHAIN_MODE=base-sepolia` |

---

## Run Status State Machine

```
running
  ├─► failed              (guards blocked or firewall rejected)
  ├─► awaiting_approval   (HITL threshold exceeded)
  │     ├─► approved_by_human → running → completed
  │     └─► rejected_by_human
  └─► completed
```

---

## Demo Scenarios

**Happy path** — Try:
> "Order 2 Dell XPS 15 from TechVendor Inc for the dev team"

**Budget blocked** — Try:
> "Buy 500 gaming chairs from UnknownVendor LLC"

**HITL triggered** — Set `HITL_THRESHOLD_USDC=500` then try:
> "Purchase 5 MacBook Pro M3 from Apple Business Store"
