# Implementation Plan: x402 Payment Gateway

## Overview

This implementation plan converts the x402 Payment Gateway design into executable tasks for building an
HTTP 402-based M2M payment system. The gateway enables any Next.js API route to be protected with a single
wrapper call. AI agents sign EIP-712 payment authorizations using on-chain wallets, and the server-side
Facilitator verifies signatures, enforces replay protection, confirms USDC settlement, and grants access.

The implementation integrates with existing Praxis infrastructure: `payment-executor.ts` → `x402-client.ts`
remains the agent-side entry point, `payment-firewall.ts` continues as the deterministic pre-payment gate,
and `run-store.ts` / `AuditLog` are extended for traceability. Mock mode (`PAYMENT_MODE=mock|hybrid`) fully
short-circuits all new components so the development workflow is unchanged.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "3"] },
    { "wave": 3, "tasks": ["4", "5"] },
    { "wave": 4, "tasks": ["6"] },
    { "wave": 5, "tasks": ["7"] },
    { "wave": 6, "tasks": ["8"] },
    { "wave": 7, "tasks": ["9"] },
    { "wave": 8, "tasks": ["10"] },
    { "wave": 9, "tasks": ["11", "13"] },
    { "wave": 10, "tasks": ["12"] },
    { "wave": 11, "tasks": ["14", "15"] },
    { "wave": 12, "tasks": ["16", "17", "18"] }
  ]
}
```

Wave 1 — DB schema and migrations (foundation for everything).
Wave 2 — Chain config registry and nonce registry (no DB dependency on each other).
Wave 3 — EIP-712 signer and settlement engine (depend on chain config and nonce registry).
Wave 4 — Checkpoint: verify all crypto primitives pass tests.
Wave 5 — PaymentIntent lifecycle tracker (depends on DB models).
Wave 6 — Facilitator endpoint (depends on nonce registry, EIP-712, settlement, payment intent).
Wave 7 — withX402 middleware (depends on Facilitator, nonce registry, payment intent).
Wave 8 — Checkpoint: full 402 → sign → retry → verify cycle verified end-to-end.
Wave 9 — x402 client (depends on EIP-712 signer) and webhook queue (depends on DB models) — parallel.
Wave 10 — Payment executor integration (depends on x402 client).
Wave 11 — Gateway management API routes and nonce cleanup cron — parallel.
Wave 12 — Dashboard UI, vendor route protection, env docs — parallel.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Add gateway models to Prisma schema
    - Define `NonceRecord` model: `id`, `nonce` (unique), `resource`, `amountUsdc`, `payTo`, `network`, `status` (default "pending"), `issuedAt`, `expiresAt`, `usedAt`, `usedByTx`, `ipAddress`; indexes on `nonce`, `status`, `expiresAt`
    - Define `PaymentRecord` model: `id`, `nonce` (unique), `paymentIntentId` (unique), `resource`, `payerAddress`, `payTo`, `amountUsdc`, `amountAtomicUnits`, `asset`, `network`, `chainId`, `signature`, `txHash`, `settlementMode`, `verifiedAt`, `tenantId`, `runId`; indexes on `resource`, `payerAddress`, `verifiedAt`, `tenantId`
    - Define `PaymentIntent` model: `id`, `nonce` (unique), `correlationId`, `idempotencyKey` (unique), `resource`, `amountUsdc`, `payTo`, `payerAddress`, `chainId`, `status` (default "CREATED"), `failureReason`, `paymentRecordId`, `createdAt`, `verifyingAt`, `settledAt`, `failedAt`, `expiresAt`; indexes on `nonce`, `status`, `resource`, `createdAt`, `correlationId`
    - Define `EndpointConfig` model: `id`, `resource` (unique), `amountUsdc`, `description`, `payTo`, `asset`, `network`, `chainId`, `nonceTtlSeconds` (default 300), `isActive` (default true), `tenantId`, `createdAt`, `updatedAt`; indexes on `resource`, `tenantId`
    - Define `WebhookEndpoint` model: `id`, `tenantId`, `url`, `secret`, `events`, `isActive`, `createdAt`, `updatedAt`
    - Define `WebhookDelivery` model: `id`, `endpointId`, `event`, `payload`, `correlationId`, `responseStatus`, `attemptCount`, `nextRetryAt`, `status` (default "queued"), `createdAt`, `deliveredAt`
    - Extend `PolicyConfig` with `allowX402Gateway` (Boolean, default true), `x402SettlementMode` (String, default "pre-signed"), `x402MaxAmountUsdc` (String, default "100.00")
    - All `amountUsdc` fields must be `String` type — never `Float`
    - File: `prisma/schema.prisma`
    - _Requirements: 9.1, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_
  - [x] 1.2 Run Prisma migration
    - Run `npx prisma migrate dev --name x402-gateway` and `npx prisma generate`
    - Confirm all new tables exist in `prisma/dev.db`
    - File: `prisma/migrations/` (auto-generated)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 2. Chain configuration registry
  - [x] 2.1 Implement `src/gateway/chain-config.ts`
    - Export `ChainConfig` interface: `chainId`, `caip2`, `name`, `rpcUrl`, `usdcAddress`, `explorerUrl`, `registryAddress?`, `blockTimeMs`
    - Define `SUPPORTED_CHAINS` map: Base Sepolia (84532) as default, Base Mainnet (8453) as opt-in
    - Resolve all `rpcUrl` values from env vars (`BASE_SEPOLIA_RPC_URL`, `BASE_MAINNET_RPC_URL`) — never hardcode
    - Implement `getChainConfig(chainId?: number): ChainConfig` — throws descriptive error for unsupported IDs
    - Implement `getDefaultChain(): ChainConfig` — reads `DEFAULT_CHAIN_ID` env var, falls back to Base Sepolia (84532)
    - File: `src/gateway/chain-config.ts`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  - [ ]* 2.2 Property test for chain configuration
    - **Property: `getChainConfig(id)` always returns a `ChainConfig` whose `chainId` equals `id` for every supported chain ID**
    - **Validates: Requirements 7.1, 7.4**
    - File: `src/gateway/__tests__/chain-config.test.ts`

- [x] 3. Nonce registry
  - [x] 3.1 Implement `src/gateway/nonce-registry.ts`
    - Implement `createNonce(config): Promise<NonceRecord>` — generate UUID v4 via `crypto.randomUUID()`, hard-cap `expiresAt = min(now + nonceTtlSeconds, now + 300)`
    - Implement `consumeNonce(nonce): Promise<boolean>` — atomic `pending → used` in a single `prisma.$transaction`, return `false` if already `used` or `expired`
    - Implement `getNonce(nonce): Promise<NonceRecord | null>`
    - Implement `validateNonceBinding(nonce, resource, amountUsdc, payTo): Promise<boolean>` — reject if nonce was issued for different resource/amount/payTo
    - File: `src/gateway/nonce-registry.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.8_
  - [ ]* 3.2 Property test for nonce registry
    - **Property: `consumeNonce(nonce)` returns `true` exactly once for any given nonce — all subsequent calls return `false`**
    - **Validates: Requirements 4.3, 4.6**
    - File: `src/gateway/__tests__/nonce-registry.test.ts`

- [x] 4. EIP-712 signer (agent side)
  - [x] 4.1 Implement `src/gateway/eip712-signer.ts`
    - Define `PaymentAuthorization` interface: `payer`, `payTo`, `asset`, `network`, `amount`, `amountAtomicUnits`, `resource`, `nonce`, `expiry`
    - Define EIP-712 type definitions matching viem `TypedData` format
    - Implement `buildDomain(chainId: number)` — reads chain from `getChainConfig()`, sets `name: "PraxisX402"`, `version: "1"` — no hardcoded chain IDs
    - Implement `signPaymentAuthorization(authorization, privateKey, chainId): Promise<string>` — calls viem `signTypedData`, returns base64url of `JSON({ signature, authorization })`
    - Derive `amountAtomicUnits` via `parseUnits(amount, 6)` — no `parseFloat`, no `* 1_000_000`
    - `AGENT_PRIVATE_KEY` must stay server-side only — never imported in any `app/` client path
    - File: `src/gateway/eip712-signer.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.2_
  - [ ]* 4.2 Property test for EIP-712 signer
    - **Property: For any valid `PaymentAuthorization` signed with key K, `recoverTypedDataAddress` returns `privateKeyToAddress(K)`**
    - **Validates: Requirements 6.6, 3.4**
    - File: `src/gateway/__tests__/eip712-signer.test.ts`
  - [ ]* 4.3 Property test for amount integrity
    - **Property: For any valid USDC decimal string S, `formatUnits(parseUnits(S, 6), 6) === S` — no float intermediary**
    - **Validates: Requirements 9.2, 9.3, 9.5**
    - File: `src/gateway/__tests__/amount-integrity.test.ts`

- [x] 5. Settlement engine
  - [x] 5.1 Implement `src/gateway/settlement.ts`
    - Define `SettlementResult` interface: `txHash`, `confirmedAt`, `mode`, `blockNumber`
    - Implement `settlePayment(authorization, mode, confirmations, correlationId): Promise<SettlementResult>`
    - `pre-signed` mode: call `publicClient.getLogs` for `USDC.Transfer` from `payer → payTo`; compare amounts using `parseUnits` BigInt — never `parseFloat`
    - When `confirmations === 0`: accept Transfer log immediately; when `confirmations >= 1`: call `waitForTransactionReceipt({ confirmations, timeout: GATEWAY_SETTLEMENT_TIMEOUT_MS })`
    - `facilitator` mode: call `walletClient.writeContract` with `GATEWAY_PRIVATE_KEY` to execute `USDC.transferFrom`; return `reason: "settlement_failed"` on revert
    - Resolve all chain values from `getChainConfig(chainId)` — never hardcode RPC URL, USDC address, or chain ID
    - Include `correlationId` in every log line
    - File: `src/gateway/settlement.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 9.4_
  - [ ]* 5.2 Unit tests for settlement engine
    - Mock viem `publicClient.getLogs` and `walletClient.writeContract`
    - Test `pre-signed` mode: match found, no match (`transfer_not_found`), amount mismatch
    - Test `facilitator` mode: successful transfer, reverted transfer
    - Test `confirmations=0` skips `waitForTransactionReceipt`; `confirmations>=1` calls it
    - File: `src/gateway/__tests__/settlement.test.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 6. Checkpoint — Core cryptographic primitives ready
  - Verify all tests in `src/gateway/__tests__/` pass before continuing

- [x] 7. PaymentIntent lifecycle tracker
  - [x] 7.1 Implement `src/gateway/payment-intent.ts`
    - Implement `createPaymentIntent(nonce, config, correlationId, idempotencyKey?): Promise<PaymentIntent>` — only called when `X-Payment` header is present, never on raw 402
    - Implement `transitionIntent(nonce, to: PaymentIntentStatus, meta?): Promise<void>` — enforce valid transitions: `CREATED → VERIFYING`, `VERIFYING → SETTLED`, `VERIFYING → FAILED`; throw on `SETTLED → *` or `FAILED → *`
    - Set `verifyingAt`, `settledAt`, `failedAt` timestamps on each respective transition
    - On `SETTLED` transition: set `paymentRecordId` to the linked `PaymentRecord.id`
    - On `FAILED` transition: set `failureReason` with a descriptive string
    - Implement `findByIdempotencyKey(key): Promise<PaymentIntent | null>`
    - File: `src/gateway/payment-intent.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 14.2_
  - [ ]* 7.2 Unit tests for PaymentIntent lifecycle
    - Test valid transitions: `CREATED → VERIFYING → SETTLED` and `CREATED → VERIFYING → FAILED`
    - Test that `SETTLED → *` and `FAILED → *` throw
    - Test `idempotencyKey` uniqueness enforcement via DB unique index
    - File: `src/gateway/__tests__/payment-intent.test.ts`
    - _Requirements: 8.1, 8.5_

- [x] 8. Facilitator / Verifier endpoint
  - [x] 8.1 Implement `app/api/x402/verify/route.ts`
    - Validate `X-Gateway-Token` HMAC-SHA256 header using `GATEWAY_INTERNAL_SECRET` with `timingSafeEqual`; return HTTP 401 if missing or invalid
    - Validate request body against Zod schema: `paymentHeader`, `resource`, `amountUsdc`, `payTo`, `nonce`, `network`, `correlationId`, `confirmations`, optional `idempotencyKey`
    - Decode base64url `paymentHeader` into `{ signature, authorization: PaymentAuthorization }`
    - Look up `NonceRecord` — return `reason: "nonce_used"` if `status === "used"`; `reason: "nonce_expired"` if `status === "expired"` or past `expiresAt`
    - Call `recoverTypedDataAddress` (viem) — return `reason: "invalid_signature"` if mismatch
    - Verify `authorization.amount === config.amountUsdc` via string equality; `reason: "amount_mismatch"` on failure
    - Verify `authorization.resource` and `authorization.payTo`; return `reason: "resource_mismatch"` or `reason: "payto_mismatch"` on mismatch
    - Call `validateNonceBinding(nonce, resource, amountUsdc, payTo)`
    - Dispatch to `settlePayment()` with `confirmations`
    - Atomic DB transaction: `consumeNonce(nonce)`, `INSERT PaymentRecord`, `transitionIntent(nonce, "SETTLED")`; rollback all on any failure
    - Enqueue webhook via `enqueueWebhook()` — do NOT await
    - Write exactly one `AuditLog` per call: `x402.payment_verified`, `x402.payment_failed`, `x402.replay_blocked`, or `x402.settlement_failed`
    - Echo `correlationId` in response body and `X-Correlation-Id` header
    - Apply `rateLimit` at 60 req/min per IP
    - File: `app/api/x402/verify/route.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.4, 4.5, 10.1, 10.2, 10.3, 15.8, 17.1, 17.2_
  - [ ]* 8.2 Unit tests for Facilitator endpoint
    - Test Zod validation rejects malformed requests
    - Test HMAC validation: missing token → HTTP 401, wrong token → HTTP 401
    - Test each `verified: false` reason: `nonce_used`, `nonce_expired`, `invalid_signature`, `amount_mismatch`, `resource_mismatch`, `payto_mismatch`
    - Test exactly one `AuditLog` entry written per call
    - Test `correlationId` echoed in response body and `X-Correlation-Id` header
    - File: `app/api/x402/__tests__/verify.test.ts`
    - _Requirements: 3.1, 3.2, 3.10, 14.3_

- [x] 9. withX402 middleware
  - [x] 9.1 Implement `src/gateway/with-x402.ts`
    - Define `X402Config` interface: `amountUsdc` (string), `description`, optional `resource`, `asset`, `payTo`, `network`, `nonceTtlSeconds`, `skipInMockMode` (default true), `confirmations` (default 1)
    - If `PAYMENT_MODE` is `mock` or `hybrid` and `skipInMockMode` is true: call handler directly, return its response with `mock: true` in body — no DB writes
    - If `X-Payment` header is absent: call `createNonce(config)`, return HTTP 402 with `WWW-Authenticate: x402` header and JSON body (`amount`, `payTo`, `nonce`, `expiry`, `asset`, `network`) — do NOT create `PaymentIntent`
    - If `X-Payment` header is present: extract `X-Request-Id` as `correlationId` (generate UUID if absent); extract `Idempotency-Key`
    - Idempotency check: `SETTLED` key → return cached 200; `VERIFYING` key → HTTP 409; `FAILED` key → allow retry
    - Create `PaymentIntent` with `status: "CREATED"`, then immediately transition to `VERIFYING`
    - Generate `X-Gateway-Token` HMAC and call `POST /api/x402/verify` with full `VerifyRequest`
    - On `verified: true`: call handler, transition intent to `SETTLED`, attach `X-Payment-Response` and `X-Correlation-Id` to response
    - On `verified: false`: transition intent to `FAILED`, return HTTP 402 with reason
    - Forward `X-Correlation-Id` from Facilitator response to final API response
    - Export as `withX402(config, handler) => handler`
    - File: `src/gateway/with-x402.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 2.1, 2.2, 8.2, 14.1, 17.4_
  - [ ]* 9.2 Property test for mock mode isolation
    - **Property: When `PAYMENT_MODE ∈ {mock, hybrid}`, `withX402(config, handler)` calls handler exactly once and writes zero DB rows for any input**
    - **Validates: Requirements 2.1, 2.4**
    - File: `src/gateway/__tests__/with-x402.test.ts`
  - [ ]* 9.3 Unit tests for withX402 middleware
    - Test mock mode: handler called, `mock: true` in body, no `NonceRecord` created
    - Test 402 format: all fields present (`amount`, `payTo`, `nonce`, `expiry`, `asset`, `network`)
    - Test nonce TTL hard-cap at 300s regardless of config value
    - Test idempotency: `SETTLED` → 200, `VERIFYING` → 409, `FAILED` → retry
    - Test `correlationId` propagation: `X-Request-Id` used when present, UUID generated when absent
    - File: `src/gateway/__tests__/with-x402.test.ts`
    - _Requirements: 1.2, 1.3, 1.8, 1.9, 1.10, 2.1, 2.2, 14.1_

- [x] 10. Checkpoint — Gateway core complete
  - All tests in `src/gateway/__tests__/` and `app/api/x402/__tests__/` pass
  - Wrap `/api/vendor/protected-data` with `withX402` and verify full 402 → sign → retry → 200 cycle end-to-end

- [x] 11. x402 client and circuit breaker (agent side)
  - [x] 11.1 Enhance `src/payment/x402-client.ts`
    - Import and call `signPaymentAuthorization` from `src/gateway/eip712-signer.ts`
    - Full cycle: GET resource (no header) → receive 402 body → call `signPaymentAuthorization(authorization, AGENT_PRIVATE_KEY, chainId)` → retry GET with `X-Payment` header
    - On 200: extract `X-Payment-Response` header, build `PaymentReceipt` with `mode: "x402"` and `txHash`
    - Call `runStore.setPayment(runId, receipt)`
    - Circuit breaker: `vendorFailureCounts: Map<string, number>` — increment on timeout (>6s) or error; at count 3, mark vendor `x402-degraded` and route to hybrid mode
    - On timeout: fall back to `buildMockReceipt(intent, { mode: "hybrid" })`
    - On `reason: "invalid_signature"` or `reason: "amount_mismatch"`: throw `PaymentVerificationError`
    - File: `src/payment/x402-client.ts`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.3_
  - [ ]* 11.2 Unit tests for x402 client
    - Test happy path: 402 → sign → 200 → `PaymentReceipt` with `mode: "x402"`
    - Test Facilitator timeout → hybrid fallback
    - Test circuit breaker: 3 failures → `x402-degraded` → hybrid routing
    - Test `PaymentVerificationError` on `invalid_signature` and `amount_mismatch`
    - File: `src/payment/__tests__/x402-client.test.ts`
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6_

- [x] 12. Payment executor and firewall integration
  - [x] 12.1 Update `src/payment/payment-executor.ts`
    - Ensure `runPaymentFirewall()` is called and returns `{ approved: true }` before invoking `x402-client.ts`
    - On `{ approved: false }`: do NOT call `x402-client.ts`, set run status to `failed`
    - On successful `PaymentReceipt`: call `runStore.setPayment(runId, receipt)`, link `PaymentRecord.runId` to the `Run` row
    - When a run includes an x402 payment, ensure `AuditLog` includes the `correlationId` from the payment
    - File: `src/payment/payment-executor.ts`
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [ ]* 12.2 Property test for firewall precedence
    - **Property: `x402-client.ts` is never called when `runPaymentFirewall()` returns `{ approved: false }`**
    - **Validates: Requirements 12.1, 12.2**
    - File: `src/payment/__tests__/payment-executor.test.ts`

- [x] 13. Async webhook queue
  - [x] 13.1 Implement `src/gateway/webhook-queue.ts`
    - Implement `enqueueWebhook(event, payload, tenantId?): Promise<void>` — writes one `WebhookDelivery` row and returns immediately, does not await delivery
    - Store `correlationId` in the `WebhookDelivery` payload
    - Support events: `x402.payment.settled`, `x402.payment.failed`, `x402.replay.blocked`, `x402.intent.expired`
    - File: `src/gateway/webhook-queue.ts`
    - _Requirements: 13.1, 13.2, 13.7, 14.5_
  - [x] 13.2 Implement webhook worker `app/api/gateway/webhooks/process/route.ts`
    - Fetch all `WebhookDelivery` rows with `status: "queued"` and `nextRetryAt <= now()`
    - For each: POST to URL with `X-Praxis-Signature: sha256=<HMAC-SHA256>` header from payload + endpoint secret
    - On failure: schedule retry with backoff — 1 min, 5 min, 30 min, 2 h (max 4 attempts)
    - After 4 failed attempts: set `status: "dead"`
    - File: `app/api/gateway/webhooks/process/route.ts`
    - _Requirements: 13.3, 13.4, 13.5, 13.6_
  - [ ]* 13.3 Unit tests for webhook queue
    - Test `enqueueWebhook` writes one row and returns immediately
    - Test `X-Praxis-Signature` HMAC header is computed correctly
    - Test backoff: 4 attempts → `status: "dead"`
    - File: `src/gateway/__tests__/webhook-queue.test.ts`
    - _Requirements: 13.3, 13.4, 13.5, 13.7_

- [x] 14. Gateway management API routes
  - [x] 14.1 Implement endpoint configuration routes
    - `GET /api/gateway/endpoints` — list all `EndpointConfig` records; auth: `key:manage`
    - `POST /api/gateway/endpoints` — create `EndpointConfig`; validate `amountUsdc` is a valid decimal string (reject numeric type); auth: `key:manage`; write `AuditLog: "x402.endpoint_registered"`
    - `PATCH /api/gateway/endpoints/[id]` — update `amountUsdc`, `payTo`, `description`, `isActive`; auth: `key:manage`; write `AuditLog: "x402.endpoint_updated"`
    - `DELETE /api/gateway/endpoints/[id]` — set `isActive: false`; auth: `key:manage`
    - Files: `app/api/gateway/endpoints/route.ts`, `app/api/gateway/endpoints/[id]/route.ts`
    - _Requirements: 15.1, 15.2, 15.3_
  - [x] 14.2 Implement payment history routes
    - `GET /api/gateway/payments` — paginated `PaymentRecord` list; query params: `page`, `limit`, `resource`, `payerAddress`, `from`, `to`; auth: `key:manage`
    - `GET /api/gateway/payments/[id]` — single payment detail including linked `PaymentIntent` lifecycle; auth: `key:manage`
    - Files: `app/api/gateway/payments/route.ts`, `app/api/gateway/payments/[id]/route.ts`
    - _Requirements: 15.4_
  - [x] 14.3 Implement analytics and intents routes
    - `GET /api/gateway/analytics` — return total revenue USDC (`SUM(amountUsdc) WHERE settled`), success rate (`SETTLED/CREATED*100` rolling 24h), avg settlement time, replays blocked (`COUNT AuditLog WHERE action=x402.replay_blocked` rolling 24h), pending intent count; auth: `key:manage`
    - `GET /api/gateway/intents` — paginated `PaymentIntent` list with lifecycle state; query params: `page`, `limit`, `status`; auth: `key:manage`
    - Files: `app/api/gateway/analytics/route.ts`, `app/api/gateway/intents/route.ts`
    - _Requirements: 15.5, 15.6_

- [x] 15. Nonce cleanup cron
  - [x] 15.1 Implement `app/api/gateway/nonces/cleanup/route.ts`
    - `POST /api/gateway/nonces/cleanup` — mark all `NonceRecord` rows where `expiresAt < now()` and `status === "pending"` as `expired`
    - Only mark nonces that have no corresponding `PaymentIntent` row — abandoned 402s only
    - Return `{ updated: number }` count of rows changed
    - Internal-only: validate `X-Cron-Secret` header using `CRON_SECRET` env var
    - Run at least every 5 minutes (configure in deployment)
    - File: `app/api/gateway/nonces/cleanup/route.ts`
    - _Requirements: 4.7, 8.8, 15.7_

- [x] 16. Gateway dashboard UI
  - [x] 16.1 Implement gateway overview page `app/gateway/page.tsx`
    - KPI cards: total revenue (USDC), success rate (%), avg settlement time, replay attacks blocked, pending intent count — all from live `GET /api/gateway/analytics`
    - Recent payments table (last 10) with status badges
    - PaymentIntent funnel summary: CREATED → VERIFYING → SETTLED | FAILED counts
    - File: `app/gateway/page.tsx`
    - _Requirements: 16.1_
  - [x] 16.2 Implement payment history page `app/gateway/payments/page.tsx`
    - Paginated table: nonce (truncated), payer address, resource, amount, settlement mode, txHash (BaseScan link), timestamp
    - Filter by resource, payer, date range
    - File: `app/gateway/payments/page.tsx`
    - _Requirements: 16.2_
  - [x] 16.3 Implement PaymentIntent lifecycle view `app/gateway/intents/page.tsx`
    - Table showing each intent's `status`, `correlationId`, `createdAt`, `verifyingAt`, `settledAt`/`failedAt`, `failureReason`
    - Status filter: CREATED | VERIFYING | SETTLED | FAILED
    - File: `app/gateway/intents/page.tsx`
    - _Requirements: 16.3_
  - [x] 16.4 Implement endpoint configuration page `app/gateway/endpoints/page.tsx`
    - List `EndpointConfig` records with resource, amount, isActive toggle, edit/deactivate actions
    - Inline edit form for amount, payTo, description
    - File: `app/gateway/endpoints/page.tsx`
    - _Requirements: 16.4_
  - [x] 16.5 Implement webhook delivery log `app/gateway/webhooks/page.tsx`
    - Table: event type, endpoint URL, status (queued/delivered/dead), attempt count, last attempt, next retry
    - Filter by status and event type
    - File: `app/gateway/webhooks/page.tsx`
    - _Requirements: 16.5_

- [x] 17. Protect vendor route with withX402
  - [x] 17.1 Wrap `/api/vendor/protected-data` with `withX402`
    - Import `withX402` from `src/gateway/with-x402.ts`
    - Apply with config: `amountUsdc: "1.00"`, `description: "Protected vendor data"`, `confirmations: 1`
    - File: `app/api/vendor/protected-data/route.ts`
    - _Requirements: 1.1, 2.1_

- [x] 18. Environment variable documentation
  - [x] 18.1 Update `.env.example` with all new gateway variables
    - `GATEWAY_INTERNAL_SECRET` — 32-byte hex for HMAC between withX402 and Facilitator
    - `GATEWAY_PRIVATE_KEY` — server wallet key for facilitator settlement mode
    - `SETTLEMENT_MODE` — `pre-signed` | `facilitator`
    - `GATEWAY_SETTLEMENT_TIMEOUT_MS` — timeout for `waitForTransactionReceipt` (default 30000)
    - `DEFAULT_CHAIN_ID` — chain to use (default 84532 for Base Sepolia)
    - `BASE_SEPOLIA_RPC_URL` — RPC endpoint for Base Sepolia
    - `BASE_MAINNET_RPC_URL` — RPC endpoint for Base Mainnet
    - `CRON_SECRET` — secret for internal cron routes
    - `GATEWAY_MOCK_VERIFY` — set to `true` to bypass crypto verification in dev
    - File: `.env.example`
    - _Requirements: 2.1, 5.7, 7.6, 17.3_


## Notes

- **Amount arithmetic**: All `amountUsdc` fields use `String` type in Prisma. All conversions to atomic units use `parseUnits(amount, 6)` from viem. `parseFloat`, `Number()`, and `* 1_000_000` are banned everywhere in this feature.
- **Nonce TTL**: Hard-capped at 300 seconds server-side regardless of what any config passes. Clients cannot extend nonce lifetime.
- **PaymentIntent creation**: Only created when an `X-Payment` header arrives. Raw 402 responses that are never paid never write a `PaymentIntent` row, preventing DB bloat from bots and crawlers.
- **Atomic settlement**: `consumeNonce`, `INSERT PaymentRecord`, and `UPDATE PaymentIntent → SETTLED` all happen in a single `prisma.$transaction`. Any failure rolls back all three.
- **Mock mode**: Setting `PAYMENT_MODE=mock` or `PAYMENT_MODE=hybrid` short-circuits `withX402` before any DB write. The entire gateway layer is invisible to the development workflow.
- **Property-based tests** (marked with `*`) use `fast-check`. Install with `npm install --save-dev fast-check`.
- **Facilitator internal security**: `POST /api/x402/verify` requires an `X-Gateway-Token` HMAC-SHA256 header. External callers without the `GATEWAY_INTERNAL_SECRET` cannot reach the verifier. Use `timingSafeEqual` for HMAC comparison.
- **Chain config authority**: `src/gateway/chain-config.ts` is the single source of truth. No other file hardcodes a chain ID, USDC contract address, or RPC URL.
- **Correlation ID threading**: Every log line, DB record, response header, and webhook payload includes `correlationId` so any payment can be reconstructed end-to-end from 402 issuance to webhook delivery.
- **Dashboard uses server components**: All gateway dashboard pages fetch from the gateway API routes using `key:manage` scoped API keys. No direct Prisma access from UI components.
