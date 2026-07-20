# Praxis MVP — Complete Project Context

> **Purpose:** Drop this file into any IDE at the start of a session. It gives the AI complete context of what has been built, what works, what is pending, and how every file connects. No need to re-explore the codebase.
>
> **Last updated:** 2026-07-20
> **Build status:** ✅ `npx tsc --noEmit` — zero errors · ✅ `npx next build` — clean · ✅ DB migrated · ✅ Seeded

---

## What Praxis Is

Praxis is an **autonomous agent payment firewall**. An AI agent submits a procurement request in plain English. The system parses it, runs deterministic budget + policy guards, builds a cryptographic Proof-of-Reasoning, validates it through a payment firewall, executes a payment, and anchors the proof hash on Base Sepolia.

**Core security principle:** LLM proposes → Workflow structures → Guards validate → Firewall approves → Wallet signs → Blockchain anchors. The LLM never directly authorises a payment.

---

## Quick Start

```bash
cd praxis-mvp
npm install
cp .env.example .env         # already safe for MOCK_AGENTS=true, no real keys needed
npx prisma generate
npx prisma migrate dev --name init
npx tsx prisma/seed.ts       # seeds 3 demo runs (completed, awaiting_approval, failed)
npm run dev                  # http://localhost:3000
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Agent framework | `@mastra/core@^1.36`, `@mastra/memory@^1.19`, `@mastra/ai-sdk@^1.4` |
| LLM provider | `@ai-sdk/openai` (gpt-4o-mini default) |
| Database | SQLite via Prisma 5.22 |
| Blockchain | `viem@^2.17` → Base Sepolia (84532) |
| Validation | Zod v3 |
| Language | TypeScript 5 (strict mode) |

---

## Environment Variables

**Never put real values in CONTEXT.md.** See `.env.example` for the full annotated list.

Key mode flags (the only ones needed for demo):

| Variable | Default | Effect |
|---|---|---|
| `PAYMENT_MODE` | `mock` | `mock` \| `hybrid` \| `x402` |
| `CHAIN_MODE` | `mock` | `mock` \| `local` \| `base-sepolia` |
| `MOCK_AGENTS` | `true` | Skip LLM entirely — full pipeline runs without any API key |
| `HITL_THRESHOLD_USDC` | `0` | `0` = auto-approve all; `>0` pauses for human approval |
| `API_SECRET_KEY` | _(empty)_ | Empty = auth disabled locally. Always set in production. |
| `AGENT_MAX_PAYMENT_USDC` | `50000` | Global fallback single-payment ceiling |
| `TENANT_DAILY_BUDGET_USD` | `500000` | Global fallback daily spend ceiling |

Per-tenant limits override the global env vars via `PolicyConfig` in the DB.

---

## Complete File Map

```
praxis-mvp/
│
├── middleware.ts                    ← Security headers (CSP, HSTS, nosniff, X-Frame) + CORS on every response
├── next.config.mjs                  ← Next.js 14 config (excludes contracts/hardhat from build)
├── tsconfig.json                    ← Excludes contracts/ and hardhat.config.ts
├── hardhat.config.ts                ← Hardhat config (excluded from tsc/Next.js)
│
├── app/
│   ├── layout.tsx                   ← Root layout
│   ├── globals.css                  ← CSS variables, dark theme
│   ├── page.tsx                     ← 2-panel dashboard (chat left, cards right)
│   └── api/
│       │
│       ├── purchase/route.ts        ← POST /api/purchase
│       │                               Auth: run:create · Rate: 10/min
│       │                               Passes tenantId from resolved API key to workflow
│       │
│       ├── runs/route.ts            ← GET  /api/runs
│       │                               Auth: run:read · Rate: 30/min
│       │
│       ├── runs/[runId]/route.ts    ← GET  /api/runs/:id
│       │                               Auth: run:read · Rate: 60/min
│       │
│       ├── runs/[runId]/approve/route.ts  ← POST /api/runs/:id/approve
│       │                               Auth: run:approve · Rate: 5/min
│       │                               Writes AuditLog entry on approve/reject
│       │
│       ├── vendor/quote/route.ts    ← GET  /api/vendor/quote  (no auth)
│       ├── vendor/protected-data/route.ts ← GET (x402 protected)
│       │
│       └── admin/
│           ├── tenants/route.ts                           ← GET/POST tenants
│           ├── tenants/[tenantId]/keys/route.ts           ← GET/POST API keys
│           ├── tenants/[tenantId]/keys/[keyId]/route.ts   ← GET/DELETE key
│           ├── tenants/[tenantId]/policy/route.ts         ← GET/PATCH policy limits
│           ├── tenants/[tenantId]/vendors/route.ts        ← GET/POST vendor allowlist
│           ├── tenants/[tenantId]/vendors/[vendorId]/route.ts ← PATCH/DELETE vendor
│           └── audit/route.ts                            ← GET audit log (paginated)
│
├── components/
│   ├── chat-panel.tsx               ← Prompt input + example buttons
│   ├── workflow-timeline.tsx        ← Left panel: event list with status icons
│   ├── vendor-quote-card.tsx        ← Quote display + shared Card/Row primitives
│   ├── policy-check-card.tsx        ← Budget + policy guard results
│   ├── proof-viewer.tsx             ← Agent summary + proof hash + raw JSON toggle
│   ├── payment-card.tsx             ← Payment receipt (mode badge, tx hash)
│   ├── chain-anchor-card.tsx        ← Chain anchor + BaseScan link
│   ├── approval-modal.tsx           ← HITL overlay: shows intent, approve/reject
│   └── demo-mode-badge.tsx          ← Top-right badge showing PAYMENT_MODE/CHAIN_MODE
│
├── contracts/
│   ├── PraxisPaymentRegistry.sol    ← PRODUCTION-READY. See contracts section below.
│   ├── PraxisDeferredEscrow.sol     ← STRETCH. See contracts section below.
│   └── deploy.ts                    ← Hardhat deploy script → writes to src/blockchain/deployments.ts
│
├── prisma/
│   ├── schema.prisma                ← 7 models. See DB schema section below.
│   ├── seed.ts                      ← 3 demo runs: completed, awaiting_approval, failed
│   ├── dev.db                       ← SQLite database (gitignored)
│   └── migrations/                  ← Auto-generated. Two migrations applied.
│
└── src/
    ├── types/
    │   ├── purchase.ts              ← PurchaseIntent, VendorQuote
    │   ├── proof.ts                 ← ProofOfReasoning, BudgetDecision, PolicyDecision, ProofHash
    │   ├── payment.ts               ← PaymentIntent, PaymentReceipt, ChainAnchor
    │   └── run.ts                   ← RunStatus, EventType, EventStatus, RunEventInput
    │
    ├── db/prisma.ts                 ← Prisma singleton (globalThis pattern for HMR)
    │
    ├── store/run-store.ts           ← All Run/RunEvent DB ops. JSON↔String serialisation.
    │                                   create(runId, prompt, tenantId?) ← now tenant-aware
    │
    ├── policy/
    │   ├── budget-guard.ts          ← async runBudgetGuard(intent, tenantId?)
    │   │                               Reads PolicyConfig from DB when tenantId present.
    │   │                               Falls back to AGENT_MAX_PAYMENT_USDC env var.
    │   └── policy-guard.ts          ← async runPolicyGuard(intent, quote, tenantId?)
    │                                   Reads VendorAllowlist from DB when tenantId present.
    │                                   Enforces per-vendor paymentAddress lock + maxOrderUsdc cap.
    │                                   Falls back to hardcoded GLOBAL_APPROVED_VENDORS list.
    │
    ├── proof/hash-proof.ts          ← hashProof(): canonical JSON (sorted keys) → SHA-256 → 0x hex
    │
    ├── payment/
    │   ├── payment-firewall.ts      ← Deterministic gate. 5 checks: runId, both guards, amount, payee.
    │   ├── payment-executor.ts      ← Entry point. Reads PAYMENT_MODE → mock|hybrid|x402.
    │   ├── mock-payment.ts          ← Returns realistic mock receipt.
    │   └── x402-client.ts           ← x402 call with 6s timeout → hybrid fallback on failure.
    │
    ├── blockchain/
    │   ├── registry-client.ts       ← anchorPayment(). 8s RPC timeout → mock fallback.
    │   ├── registry-abi.ts          ← Full ABI for PraxisPaymentRegistry (updated with chainId param).
    │   └── deployments.ts           ← Written by deploy.ts. Contract addresses per network.
    │
    ├── lib/security/
    │   ├── api-keys.ts              ← Key generation, hashing, CRUD, resolveApiKey().
    │   │                               Format: prx_live_<32hex> or prx_test_<32hex>
    │   │                               Stores SHA-256 hash only — raw key shown once.
    │   ├── api-auth.ts              ← requireAuth(req, scope) — DB-backed, scope-enforced.
    │   │                               Fallback chain: DB key → env API_SECRET_KEY → disabled.
    │   ├── rate-limiter.ts          ← In-memory sliding window per IP/bucket.
    │   ├── sanitize.ts              ← sanitizePrompt (500 char), sanitizeItem, parseApprovedField.
    │   └── logger.ts                ← Structured logger. Redacts secrets. Sanitises errors in prod.
    │
    └── mastra/
        ├── index.ts                 ← new Mastra({ agents }). initializeActivityStreaming() wraps all tools.
        ├── lib/
        │   ├── models.ts            ← resolveModel(requestContext). Default: gpt-4o-mini.
        │   └── activity-stream.ts   ← emitActivity() + activityResult(). Real-time UI events.
        ├── agents/
        │   ├── procurement-agent.ts ← id:"procurement-agent". Tools: fetchVendorQuoteTool.
        │   ├── guard-agent.ts       ← id:"guard-agent". Tools: runBudgetGuardTool + runPolicyGuardTool (parallel).
        │   └── proof-agent.ts       ← id:"proof-agent". Tools: buildProofTool.
        ├── tools/
        │   ├── fetch-vendor-quote-tool.ts   ← id:"fetch_vendor_quote"
        │   ├── run-budget-guard-tool.ts     ← id:"run_budget_guard" — async, passes tenantId
        │   ├── run-policy-guard-tool.ts     ← id:"run_policy_guard" — async, passes tenantId
        │   ├── build-proof-tool.ts          ← id:"build_proof_of_reasoning"
        │   ├── execute-payment-tool.ts      ← id:"execute_payment"
        │   └── anchor-chain-tool.ts         ← id:"anchor_payment_on_chain"
        └── workflows/
            └── purchase-workflow.ts         ← runPurchaseWorkflow(runId, prompt, tenantId?)
                                                resumePurchaseWorkflow(runId)
```

---

## Database Schema (7 Models)

All JSON stored as `String?` — SQLite has no native JSON type. `run-store.ts` serialises/deserialises transparently.

```
Tenant
  id, name, slug (unique), isActive, createdAt, updatedAt
  → apiKeys[], runs[], policyConfig?, vendorAllowlist[], auditLogs[]

ApiKey
  id, tenantId, name
  keyHash (SHA-256, unique — never the raw key)
  keyPrefix (first 12 chars for display e.g. "prx_live_xxxx")
  scopes (comma-separated: run:create,run:read,run:approve,key:manage,...)
  isActive, expiresAt?, lastUsedAt?, revokedAt?, createdAt
  → tenant, auditLogs[]

PolicyConfig (1:1 with Tenant)
  tenantId (unique)
  maxSinglePaymentUsdc  (default 50,000)
  dailyBudgetUsd        (default 500,000)
  hitlThresholdUsdc     (default 0 = auto-approve)
  requireProofForAll    (default true)
  allowMockPayments     (default true)
  createdAt, updatedAt

VendorAllowlist
  id, tenantId, vendorName (lowercase), paymentAddress?, maxOrderUsdc?
  isActive, createdAt
  @@unique([tenantId, vendorName])

Run
  id, tenantId?, apiKeyId?, status, prompt
  intentJson, quoteJson, budgetJson, policyJson
  proofJson, proofHash, paymentJson, receiptJson
  protectedJson, chainAnchorJson
  createdAt, updatedAt
  → tenant?, events[]

RunEvent
  id, runId, type, label, status, payload?, createdAt
  type:   workflow | guard | proof | payment | chain | hitl
  status: pending | success | failed | rejected

AuditLog (append-only, never deleted)
  id, tenantId?, apiKeyId?
  action     (run.create, run.approve, run.reject, key.create, key.revoke, policy.update, vendor.add, vendor.remove)
  actorType  (api_key | system | human)
  resourceId?, metadata? (JSON string, sanitised), ipAddress?, createdAt
```

---

## API Key System

**Key format:** `prx_live_<32 random hex>` or `prx_test_<32 random hex>`

**Security:**
- Raw key generated with `crypto.randomBytes(32)` — shown **once** at creation, never stored
- DB stores `SHA-256(rawKey)` only
- `resolveApiKey(rawKey)` hashes the incoming token and does a DB lookup
- Checks: `isActive`, `revokedAt`, `expiresAt`, `tenant.isActive` — all must pass

**Scopes:**
| Scope | Used by |
|---|---|
| `run:create` | `POST /api/purchase` |
| `run:read` | `GET /api/runs`, `GET /api/runs/:id` |
| `run:approve` | `POST /api/runs/:id/approve` |
| `key:manage` | All `/api/admin/` routes |
| `policy:read` | `GET /api/admin/tenants/:id/policy` |
| `policy:write` | `PATCH /api/admin/tenants/:id/policy` |
| `vendor:read` | `GET /api/admin/tenants/:id/vendors` |
| `vendor:write` | `POST/PATCH/DELETE /api/admin/tenants/:id/vendors` |

**Auth fallback chain:**
1. DB key lookup (hashed bearer token)
2. `API_SECRET_KEY` env var (single-key demo fallback)
3. Auth fully disabled (no key in DB, no env var set)

**Create a tenant + key (curl example):**
```bash
# Create tenant (auth disabled locally)
curl -X POST http://localhost:3000/api/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","slug":"acme-corp"}'

# Create API key — copy the "key" field immediately, it will not be shown again
curl -X POST http://localhost:3000/api/admin/tenants/<tenantId>/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"Dashboard key","scopes":["run:create","run:read","run:approve"]}'
```

---

## API Reference — Full

| Method | Route | Auth scope | Rate | What it does |
|---|---|---|---|---|
| POST | `/api/purchase` | `run:create` | 10/min | Start workflow. Body: `{ prompt: string }` |
| GET | `/api/runs` | `run:read` | 30/min | List all runs (newest first) |
| GET | `/api/runs/:runId` | `run:read` | 60/min | Single run with all events |
| POST | `/api/runs/:runId/approve` | `run:approve` | 5/min | HITL: `{ approved: boolean }` |
| GET | `/api/vendor/quote` | none | 30/min | Mock free quote. Params: `item`, `qty` |
| GET | `/api/vendor/protected-data` | none | 20/min | x402 protected endpoint |
| GET | `/api/admin/tenants` | `key:manage` | — | List all tenants |
| POST | `/api/admin/tenants` | `key:manage` | 5/min | Create tenant + default policy |
| GET | `/api/admin/tenants/:id/keys` | `key:manage` | — | List keys (no hashes) |
| POST | `/api/admin/tenants/:id/keys` | `key:manage` | 10/min | Create key — raw shown once |
| GET | `/api/admin/tenants/:id/keys/:keyId` | `key:manage` | — | Key details |
| DELETE | `/api/admin/tenants/:id/keys/:keyId` | `key:manage` | — | Revoke key |
| GET | `/api/admin/tenants/:id/policy` | `policy:read` | — | Get payment limits |
| PATCH | `/api/admin/tenants/:id/policy` | `policy:write` | — | Update limits |
| GET | `/api/admin/tenants/:id/vendors` | `vendor:read` | — | List vendor allowlist |
| POST | `/api/admin/tenants/:id/vendors` | `vendor:write` | 20/min | Add vendor |
| PATCH | `/api/admin/tenants/:id/vendors/:id` | `vendor:write` | — | Update vendor |
| DELETE | `/api/admin/tenants/:id/vendors/:id` | `vendor:write` | — | Remove vendor |
| GET | `/api/admin/audit` | `key:manage` | — | Paginated audit log. Params: `tenantId`, `action`, `limit`, `cursor` |

---

## The Workflow — Sequence

`src/mastra/workflows/purchase-workflow.ts` — `runPurchaseWorkflow(runId, prompt, tenantId?)`

```
POST /api/purchase  →  auth resolves tenantId from API key
  → runStore.create(runId, prompt, tenantId)        [DB: Run row]
  → AuditLog.create("run.create")                   [DB]
  → runPurchaseWorkflow(runId, prompt, tenantId)
      │
      ├─ MOCK_AGENTS=true OR no OPENAI_API_KEY?
      │   YES → mockParseIntent() heuristic parser
      │   NO  → procurement-agent.generate()
      │
      ├─ runStore.setIntent() + addEvent("intent_parsed")
      ├─ runStore.setQuote()  + addEvent("vendor_quote_fetched")
      │
      ├─ MOCK_AGENTS=true?
      │   YES → runBudgetGuard(intent, tenantId)   ← reads DB PolicyConfig
      │         runPolicyGuard(intent, quote, tenantId) ← reads DB VendorAllowlist
      │   NO  → guard-agent.generate() → both tools IN PARALLEL
      │
      ├─ runStore.setBudget() + addEvent("budget_check")
      ├─ runStore.setPolicy() + addEvent("policy_check")
      │
      ├─ Guards failed? → addEvent("firewall_BLOCKED") + setStatus("failed") → return
      │
      ├─ proof-agent / fallback → hashProof() ALWAYS server-side
      ├─ runStore.setProof()  + addEvent("proof_generated")
      │
      ├─ HITL_THRESHOLD_USDC > 0 AND amount > threshold?
      │   YES → setStatus("awaiting_approval") → return
      │
      ├─ runPaymentFirewall() — deterministic, 5 checks, NO agent
      ├─ executePayment()     — reads PAYMENT_MODE
      ├─ runStore.setPayment() + addEvent("payment_settled")
      │
      ├─ anchorPayment()      — reads CHAIN_MODE, 8s timeout → fallback
      ├─ runStore.setChainAnchor() + addEvent("proof_anchored")
      │
      └─ setStatus("completed") → return full run
```

### HITL resume: `POST /api/runs/:id/approve { approved: boolean }`
- Writes AuditLog `run.approve` or `run.reject`
- Resumes from payment firewall step via `resumePurchaseWorkflow(runId)`

### Run status state machine
```
running
  ├─ failed              (guards blocked, firewall rejected, error)
  ├─ awaiting_approval
  │   ├─ approved_by_human → running → completed
  │   └─ rejected_by_human
  └─ completed
```

---

## Contracts

### `PraxisPaymentRegistry.sol` — READY TO DEPLOY

Production-ready audit registry:
- Records: `runId`, `proofHash`, `payer`, `payee`, `token`, `amount`, `timestamp`, `chainId`
- Prevents duplicate `proofHash` anchoring (replay protection)
- `getRecord(proofHash)` — full record lookup
- `getProofHashByRunId(runId)` — reverse lookup by run ID
- `totalRecorded` counter for analytics
- `isRecorded(proofHash)` — cheap existence check
- Two-step ownership transfer (`transferOwnership` → `acceptOwnership`)
- `renounceOwnership()` for final lock-down

Deploy:
```bash
npx hardhat run contracts/deploy.ts --network base-sepolia
```

### `PraxisDeferredEscrow.sol` — STRETCH (build after registry + demo stable)

Full escrow lifecycle:
- `deposit(token, amount)` — payer deposits ERC-20 tokens
- `lockIntent(proofHash, runId, payer, payee, token, amount)` — reserves funds
- `settle(proofHash)` — releases to payee + calls registry for on-chain anchor
- `refund(proofHash)` — returns funds to payer
- `withdraw(token, amount)` — payer withdraws unlocked balance
- `batchSettle(proofHashes[])` — gas-optimised multi-settle
- Constructor takes `registry` address and `chainId` at deploy time
- ETH rejected via `receive()` / `fallback()`
- Two-step ownership transfer

---

## Security Layer

| Layer | File | What it does |
|---|---|---|
| Security headers | `middleware.ts` | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy on every response |
| CORS | `middleware.ts` | Same-origin only. Preflight handled. |
| API key auth | `api-auth.ts` | DB-backed scope enforcement. 3-tier fallback. |
| Key management | `api-keys.ts` | SHA-256 hashing, generate/create/revoke/resolve |
| Rate limiting | `rate-limiter.ts` | In-memory sliding window per IP per bucket |
| Input validation | `sanitize.ts` | Prompt 500 char max, strict boolean parse, item sanitise |
| RunId validation | `api-auth.ts` | UUID + CUID + safe slug regex |
| Structured logging | `logger.ts` | Redacts secret keys. Sanitises errors in production. |
| Audit trail | `AuditLog` model | Every security action persisted immutably to DB |

---

## Mock Parser — Price Lookup

When `MOCK_AGENTS=true` the workflow uses regex heuristics instead of the LLM.

Price resolution priority:
1. Explicit `$NNN` or `NNN usdc/each` in the prompt
2. Item name matched against lookup table (MacBook Pro → $3,499, Dell XPS → $1,800, etc.)
3. Default: $299.99

Full lookup table in `purchase-workflow.ts` `PRICE_HINTS` array.

---

## Upgrade Path

| Step | What to do |
|---|---|
| Add OpenAI key | Set `MOCK_AGENTS=false`, `OPENAI_API_KEY=sk-...` |
| Per-tenant limits | `POST /api/admin/tenants`, then `PATCH policy` |
| Add vendors to allowlist | `POST /api/admin/tenants/:id/vendors` |
| Deploy registry | `npx hardhat run contracts/deploy.ts --network base-sepolia` → set `CHAIN_MODE=base-sepolia` |
| Enable x402 | Set `PAYMENT_MODE=x402` + `FACILITATOR_URL` + `VENDOR_RECEIVER_ADDRESS` |
| Enable HITL | `PATCH /api/admin/tenants/:id/policy` with `hitlThresholdUsdc: 500` |
| Enable API auth | Set `API_SECRET_KEY=...` or create DB keys via admin API |

---

## Demo Scenarios

| Scenario | Prompt | Expected |
|---|---|---|
| Happy path | `Order 2 Dell XPS 15 from TechVendor Inc` | ✅ completed — all 8 events green |
| Budget blocked | `Buy 500 gaming chairs from UnknownVendor LLC at $800 each` | ❌ failed — $400k > single limit |
| Policy blocked | `Buy 5 chairs from UnknownVendor LLC` | ❌ failed — vendor not whitelisted |
| HITL trigger | Set `hitlThresholdUsdc=500` via policy API, then any approved order > $500 | ⏸ awaiting_approval |

---

## Global Vendor Allowlist (demo fallback)

Used when `tenantId` is null (no DB tenant resolved):

`techvendor inc` · `apple business store` · `dell technologies` · `microsoft store` · `amazon business` · `mock vendor`

Add to `GLOBAL_APPROVED_VENDORS` in `src/policy/policy-guard.ts`, or use the DB vendor allowlist per tenant.

---

## Dev Split

| Owner | Files |
|---|---|
| Dev 1 (AI/Mastra/Guards) | `src/mastra/**`, `src/policy/**`, `src/proof/**`, `src/types/**` |
| Dev 2 (Backend/DB/Payments/Contracts) | `prisma/**`, `src/db/**`, `src/store/**`, `app/api/**`, `src/payment/**`, `src/blockchain/**`, `contracts/**`, `src/lib/security/**` |
| Dev 3 (Frontend) | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/**` |

**Interface rule:** Dev 1 imports only from `run-store.ts` — never Prisma directly. All shared types live in `src/types/`.

---

## Commands Reference

```bash
npm run dev                           # Dev server → http://localhost:3000
npm run build                         # Production build
npx tsc --noEmit                      # TypeScript check only
npx prisma generate                   # Regenerate client after schema change
npx prisma migrate dev --name <name>  # Apply schema changes
npx tsx prisma/seed.ts                # Seed 3 demo runs

# Contracts (after npm install hardhat separately or in contracts/)
npx hardhat run contracts/deploy.ts --network localhost
npx hardhat run contracts/deploy.ts --network base-sepolia
```

---

## Known Issues / Fixed

| # | Issue | Status |
|---|---|---|
| 1 | `next.config.ts` not supported in Next.js 14 | ✅ → `next.config.mjs` |
| 2 | SQLite `Json` columns unsupported | ✅ → all JSON as `String` |
| 3 | Prisma seed failed on Windows (single quotes in ts-node) | ✅ → `npx tsx prisma/seed.ts` |
| 4 | Mock parser extracted model numbers as prices | ✅ → price only matches `$NNN` or explicit unit keyword |
| 5 | `AGENT_MAX_PAYMENT_USDC=1000` too low | ✅ → raised to 50,000 default |
| 6 | `HITL_THRESHOLD_USDC=5` left from testing | ✅ → reset to 0 |
| 7 | `middleware.ts` used `req.nextUrl.method` | ✅ → `req.method` |
| 8 | Budget/policy guards were synchronous, couldn't read DB | ✅ → both now async with `tenantId?` param |
| 9 | Single env-var API key — no multi-tenant, no scopes, no rotation | ✅ → full DB-backed key system |
| 10 | No audit trail for security actions | ✅ → `AuditLog` model, written on every write operation |
