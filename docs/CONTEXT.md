# Praxis MVP — Complete Project Context

> **Purpose:** Drop this file into any IDE at the start of a session. It gives the AI complete context of what has been built, what works, what is planned (see ROADMAP.md), and how every file connects.
>
> **Last updated:** 2026-07-21
> **Build status:** ✅ `npx tsc --noEmit` — zero errors · ✅ `npx next build` — clean · ✅ DB migrated · ✅ Seeded
> **Roadmap:** See `ROADMAP.md` for the complete feature specification including user auth, wallet connect, PIN/re-auth, CAPTCHA, rate limiting, invoices, notifications, and more.

---

## What Praxis Is

Praxis is an **autonomous agent payment firewall** — a blockchain payment gateway with multi-tenant management, deterministic guards, proof-of-reasoning, and on-chain proof anchoring. An AI agent (or user) submits a procurement request. The system runs budget + policy guards, builds a cryptographic Proof-of-Reasoning, validates via payment firewall, executes payment, and anchors the proof hash on Base Sepolia.

**Current stage:** MVP core complete (agent workflow, guards, proofs, mock/x402 payments, chain anchor, multi-tenant API key auth, admin API, basic dashboard UI).

**Next stage:** See `ROADMAP.md` — add user auth (login/signup/2FA), wallet connect (RainbowKit + wagmi), wallet re-auth with PIN (banking-style lock), transaction history UI, invoice system with webhooks, notifications, send/receive UI, token balances, DeFi swap, admin dashboard UI, and more.

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

**Planned additions (see ROADMAP.md):**

| Layer | Library | Purpose |
|---|---|---|
| Wallet connect | `@rainbow-me/rainbowkit`, `wagmi`, `@tanstack/react-query` | Browser wallet integration |
| CAPTCHA | `@marsidev/react-turnstile` | Cloudflare Turnstile on auth + wallet re-auth |
| Swap | 1inch API | Token swap aggregation |
| Streaming | Superfluid or Sablier v2 | Streaming payments |
| Email | Resend or Nodemailer | Notification emails |
| Auth | bcrypt + custom session | User login/signup |

---

## Environment Variables

**Never put real values in CONTEXT.md.** See `.env.example` for the full annotated list.

**Currently active mode flags:**

| Variable | Default | Effect |
|---|---|---|
| `PAYMENT_MODE` | `mock` | `mock` \| `hybrid` \| `x402` |
| `CHAIN_MODE` | `mock` | `mock` \| `local` \| `base-sepolia` |
| `MOCK_AGENTS` | `true` | Skip LLM entirely |
| `HITL_THRESHOLD_USDC` | `0` | `0` = auto-approve; `>0` = pause for human |
| `API_SECRET_KEY` | _(empty)_ | Empty = auth disabled locally |
| `AGENT_MAX_PAYMENT_USDC` | `50000` | Global fallback single-payment ceiling |
| `TENANT_DAILY_BUDGET_USD` | `500000` | Global fallback daily budget |

**To add when building ROADMAP features:**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile — client-side widget |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile — server-side verify |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect / RainbowKit |
| `BASE_RPC_URL` | Base Mainnet RPC |
| `RESEND_API_KEY` | Email notifications |
| `ONEINCH_API_KEY` | Swap aggregation |

Per-tenant limits override global env vars via `PolicyConfig` in the DB.

---

## Complete File Map

### Currently Built

```
praxis-mvp/
│
├── middleware.ts                    ← Security headers (CSP, HSTS, nosniff, X-Frame) + CORS
├── next.config.mjs                  ← Next.js 14 config
├── hardhat.config.ts                ← Hardhat config (excluded from tsc/Next.js)
│
├── app/
│   ├── layout.tsx                   ← Root layout (Google Fonts preconnect)
│   ├── globals.css                  ← CSS variables, dark theme, Inter font, animations
│   ├── page.tsx                     ← 2-panel dashboard (chat left, cards right)
│   └── api/
│       ├── purchase/route.ts        ← POST /api/purchase · Auth: run:create · Rate: 10/min
│       ├── runs/route.ts            ← GET /api/runs · Auth: run:read · Rate: 30/min
│       ├── runs/[runId]/route.ts    ← GET /api/runs/:id · Auth: run:read · Rate: 60/min
│       ├── runs/[runId]/approve/route.ts ← POST /api/runs/:id/approve · Auth: run:approve · Rate: 5/min
│       ├── vendor/quote/route.ts    ← GET /api/vendor/quote (no auth)
│       ├── vendor/protected-data/route.ts ← GET (x402 protected)
│       └── admin/
│           ├── tenants/route.ts
│           ├── tenants/[tenantId]/keys/route.ts
│           ├── tenants/[tenantId]/keys/[keyId]/route.ts
│           ├── tenants/[tenantId]/policy/route.ts
│           ├── tenants/[tenantId]/vendors/route.ts
│           ├── tenants/[tenantId]/vendors/[vendorId]/route.ts
│           └── audit/route.ts
│
├── components/
│   ├── chat-panel.tsx               ← Prompt input + example buttons
│   ├── workflow-timeline.tsx        ← Event list with status icons + type badges
│   ├── vendor-quote-card.tsx        ← Quote display + shared Card/Row/Divider primitives
│   ├── policy-check-card.tsx        ← Budget + policy guard results with GuardHeader
│   ├── proof-viewer.tsx             ← Agent summary + proof hash + collapsible raw JSON
│   ├── payment-card.tsx             ← Payment receipt (mode badge, settled indicator)
│   ├── chain-anchor-card.tsx        ← Chain anchor + hover BaseScan link
│   ├── approval-modal.tsx           ← HITL overlay: intent + summary + approve/reject
│   └── demo-mode-badge.tsx          ← Mode badge with pulsing dot indicator
│
├── docs/
│   ├── CONTEXT.md                   ← This file
│   └── ROADMAP.md                   ← Complete feature specification for everything to build
│
├── contracts/
│   ├── PraxisPaymentRegistry.sol    ← Production-ready. Ready to deploy.
│   ├── PraxisDeferredEscrow.sol     ← Stretch. Ready to deploy.
│   └── deploy.ts                    ← Hardhat deploy → writes to src/blockchain/deployments.ts
│
├── prisma/
│   ├── schema.prisma                ← 7 models (see DB Schema section)
│   ├── seed.ts                      ← 3 demo runs
│   └── migrations/                  ← Two migrations applied
│
└── src/
    ├── types/
    │   ├── purchase.ts, proof.ts, payment.ts, run.ts
    │
    ├── db/prisma.ts                 ← Prisma singleton
    ├── store/run-store.ts           ← All Run/RunEvent DB ops. JSON↔String serialisation.
    │
    ├── policy/
    │   ├── budget-guard.ts          ← async runBudgetGuard(intent, tenantId?)
    │   └── policy-guard.ts          ← async runPolicyGuard(intent, quote, tenantId?)
    │
    ├── proof/hash-proof.ts          ← SHA-256 canonical proof hash
    │
    ├── payment/
    │   ├── payment-firewall.ts      ← 5-check deterministic gate
    │   ├── payment-executor.ts      ← Entry point — reads PAYMENT_MODE
    │   ├── mock-payment.ts
    │   └── x402-client.ts           ← x402 with 6s timeout → hybrid fallback
    │
    ├── blockchain/
    │   ├── registry-client.ts       ← anchorPayment() — 8s timeout → mock fallback
    │   ├── registry-abi.ts
    │   └── deployments.ts
    │
    ├── lib/security/
    │   ├── api-keys.ts              ← Key generation, hashing, CRUD
    │   ├── api-auth.ts              ← requireAuth(req, scope) — DB-backed
    │   ├── rate-limiter.ts          ← In-memory sliding window (API routes only)
    │   ├── sanitize.ts
    │   └── logger.ts
    │
    └── mastra/
        ├── index.ts
        ├── lib/models.ts, activity-stream.ts
        ├── agents/procurement-agent.ts, guard-agent.ts, proof-agent.ts
        ├── tools/fetch-vendor-quote-tool.ts, run-budget-guard-tool.ts,
        │        run-policy-guard-tool.ts, build-proof-tool.ts,
        │        execute-payment-tool.ts, anchor-chain-tool.ts
        └── workflows/purchase-workflow.ts
```

---

### Planned (see ROADMAP.md for full spec)

```
app/
├── login/page.tsx                   ← Login with adaptive CAPTCHA (appears after 3 failures)
├── signup/page.tsx                  ← Signup with always-on CAPTCHA + password strength meter
├── profile/page.tsx                 ← Identity, security, wallet PIN, spending controls, sessions
├── history/page.tsx                 ← Run history with filters, pagination, detail drawer
├── wallet/reauth/page.tsx           ← PIN pad / password re-auth gate (banking-style)
├── send/page.tsx                    ← Manual send flow with PIN confirmation
├── swap/page.tsx                    ← Token swap via 1inch
├── escrow/page.tsx                  ← Escrow positions
├── invoices/page.tsx                ← Merchant invoice list + create
├── pay/[paymentLink]/page.tsx       ← Public invoice payment page
├── admin/
│   ├── layout.tsx
│   ├── tenants/page.tsx
│   ├── tenants/[tenantId]/page.tsx
│   ├── tenants/[tenantId]/keys/page.tsx
│   ├── tenants/[tenantId]/policy/page.tsx
│   ├── tenants/[tenantId]/vendors/page.tsx
│   ├── audit/page.tsx
│   └── analytics/page.tsx
└── api/
    ├── auth/signup, login, logout, me, password, forgot-password, reset-password
    ├── auth/2fa/setup, verify, disable
    ├── wallet/reauth, pin
    ├── wallets/, wallets/[id], wallets/challenge, wallets/[id]/balances
    ├── runs/export, runs/[runId]/stream
    ├── notifications/, notifications/[id], notifications/stream
    ├── invoices/, invoices/[id], invoices/[id]/qr
    ├── contacts/
    ├── txs/sync
    ├── admin/tenants/[id]/webhooks
    ├── admin/analytics/overview, timeseries, vendors
    ├── admin/compliance/report
    ├── admin/batches
    └── cron/balance-check

components/
├── captcha-widget.tsx               ← Cloudflare Turnstile wrapper
├── pin-pad.tsx                      ← 6-digit UPI-style PIN pad
├── confirm-action-modal.tsx         ← Reusable PIN/password confirm modal
├── wallet-connect-button.tsx        ← RainbowKit styled button
├── wallet-manager.tsx               ← Linked wallets list
├── wallet-balance-card.tsx          ← Token balances
├── address-display.tsx              ← Truncated address + copy + BaseScan
├── network-badge.tsx                ← Chain switcher
├── run-history-table.tsx            ← Virtualized run list
├── run-detail-drawer.tsx            ← Right slide-over run detail
├── notification-bell.tsx            ← Header bell + dropdown
├── invoice-card.tsx
├── create-invoice-modal.tsx
├── receive-modal.tsx
├── address-book.tsx
├── token-selector.tsx
├── token-import-modal.tsx
└── approvals-manager.tsx

src/
├── lib/
│   ├── auth/session.ts, password.ts, totp.ts, wallet-session.ts, action-auth.ts
│   ├── security/captcha.ts, auth-rate-limiter.ts, address-screening.ts, rate-limiter-db.ts
│   ├── wagmi/config.ts
│   ├── tokens/registry.ts, balances.ts
│   ├── prices/feed.ts
│   ├── gas/estimate.ts
│   ├── ens/resolve.ts
│   ├── tx/simulate.ts
│   ├── swap/oneinch.ts, slippage.ts
│   ├── chains/registry.ts
│   ├── webhooks/deliver.ts
│   ├── notifications/create.ts, email.ts, balance-monitor.ts
│   └── compliance/kyc-check.ts
├── payment/usdc-transfer.ts, streaming.ts
├── blockchain/escrow-client.ts
├── proof/merkle-batch.ts
└── policy/user-spending-guard.ts
---

## Database Schema

### Currently Built — 7 Models

All JSON stored as `String?` — SQLite has no native JSON type. `run-store.ts` handles serialisation.

```
Tenant          id, name, slug (unique), isActive, createdAt, updatedAt

ApiKey          id, tenantId, name, keyHash (SHA-256 unique), keyPrefix
                scopes (comma-sep), isActive, expiresAt?, lastUsedAt?, revokedAt?

PolicyConfig    tenantId (unique 1:1), maxSinglePaymentUsdc (50k), dailyBudgetUsd (500k)
                hitlThresholdUsdc (0=auto), requireProofForAll, allowMockPayments

VendorAllowlist id, tenantId, vendorName (lowercase), paymentAddress?, maxOrderUsdc?
                @@unique([tenantId, vendorName])

Run             id, tenantId?, apiKeyId?, status, prompt
                intentJson, quoteJson, budgetJson, policyJson
                proofJson, proofHash, paymentJson, receiptJson, chainAnchorJson
                createdAt, updatedAt → events[]

RunEvent        id, runId, type, label, status, payload?, createdAt
                type: workflow|guard|proof|payment|chain|hitl

AuditLog        id, tenantId?, apiKeyId?, action, actorType (api_key|system|human)
                resourceId?, metadata? (JSON sanitised), ipAddress?, createdAt
                APPEND-ONLY
```

### Planned Models — Future Migrations (see ROADMAP.md)

```
User            email (unique), passwordHash (bcrypt 12), role (user|admin)
                walletPin? (bcrypt), totpSecret?, totpEnabled, backupCodes?

Session         userId, token (SHA-256 unique), expiresAt, ipAddress?, userAgent?

AuthRateLimit   key (unique), attempts, windowStart, lockedUntil?

SpendingLimit   userId (unique), dailyLimitUsdc, perTxLimitUsdc, requireApprovalAboveUsdc

Wallet          userId, address (checksummed), chainId, walletType, isDefault

Invoice         tenantId, description, amountUsdc, payToAddress
                status (pending|paid|expired|cancelled), paymentLink (unique)

WebhookEndpoint tenantId, url, secret (HMAC encrypted), events, isActive

WebhookDelivery endpointId, event, payload, responseStatus?, attemptCount, nextRetryAt?

Notification    userId, type, title, body, metadata?, isRead, readAt?

Contact         userId, label, address, chainId? · @@unique([userId, address])

PendingTx       userId, txHash (unique), chainId, type, status, nonce

StreamingPayment tenantId, payerAddress, payeeAddress, tokenAddress, ratePerSecond, status

MerkleBatch     merkleRoot (unique), anchorTxHash?, chainId, runIds (JSON), proofHashes (JSON)
```

---

## API Key System (M2M Auth)

**Format:** `prx_live_<32 hex>` or `prx_test_<32 hex>` — raw shown **once**, DB stores SHA-256 only.

**Scopes:** `run:create` · `run:read` · `run:approve` · `key:manage` · `policy:read/write` · `vendor:read/write`

**Fallback chain:** DB key lookup → `API_SECRET_KEY` env var → auth disabled

```bash
# Create tenant + key (auth disabled locally)
curl -X POST http://localhost:3000/api/admin/tenants \
  -H "Content-Type: application/json" -d '{"name":"Acme","slug":"acme"}'

curl -X POST http://localhost:3000/api/admin/tenants/<id>/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"CI key","scopes":["run:create","run:read","run:approve"]}'
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
