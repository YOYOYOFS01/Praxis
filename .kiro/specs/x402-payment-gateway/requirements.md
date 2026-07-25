# Requirements Document

## Introduction

The x402 Payment Gateway adds an HTTP 402-based machine-to-machine (M2M) payment layer to the Praxis platform.
Any Next.js API route can be protected with a single wrapper function. AI agents and automated callers receive
an HTTP 402 response when no payment is present, sign an EIP-712 `PaymentAuthorization` using their on-chain
wallet, and retry with an `X-Payment` header. The server-side Facilitator verifies the signature, enforces
replay protection via an atomic nonce registry, confirms USDC settlement on-chain, and grants access.

The feature slots into the existing Praxis infrastructure: `payment-executor.ts` → `x402-client.ts` remains
the agent-side entry point, `payment-firewall.ts` continues to run as the deterministic pre-payment gate,
and `run-store.ts` / `AuditLog` are extended for traceability. Mock mode (`PAYMENT_MODE=mock|hybrid`) fully
short-circuits all new components so the development workflow is unaffected.

## Glossary

- **Gateway**: The x402 Payment Gateway — all new components described in this document.
- **withX402**: Higher-order function that wraps a Next.js App Router handler with x402 payment enforcement.
- **Facilitator**: The server-side verifier at `POST /api/x402/verify` that validates signatures and settles payments.
- **Settlement_Engine**: `src/gateway/settlement.ts` — executes on-chain USDC settlement in two modes.
- **EIP712_Signer**: `src/gateway/eip712-signer.ts` — builds and signs EIP-712 `PaymentAuthorization` payloads on the agent side.
- **Chain_Config**: `src/gateway/chain-config.ts` — single source of truth for all chain-specific values.
- **Nonce_Registry**: The combination of `NonceRecord` Prisma model and `createNonce` / `consumeNonce` functions.
- **PaymentIntent**: Prisma model tracking the lifecycle of a single payment attempt (CREATED → VERIFYING → SETTLED | FAILED).
- **PaymentRecord**: Prisma model for the immutable ledger of verified payments.
- **NonceRecord**: Prisma model for replay-protection nonces with a TTL hard-capped at 300 seconds.
- **EndpointConfig**: Prisma model registering each x402-protected route and its payment parameters.
- **Webhook_Queue**: `src/gateway/webhook-queue.ts` — enqueues asynchronous webhook deliveries.
- **Gateway_Dashboard**: `app/gateway/page.tsx` and sub-pages — operator-facing analytics and configuration UI.
- **PaymentAuthorization**: EIP-712 typed-data structure signed by the agent to authorize a payment.
- **correlationId**: UUID threaded through every log line, header, and DB record for end-to-end tracing.
- **USDC**: USD Coin ERC-20 token — the only settlement currency in this gateway.
- **Pre-Signed_Mode**: Settlement mode where the agent transfers USDC before retrying; Facilitator only reads Transfer logs.
- **Facilitator_Mode**: Settlement mode where the server wallet calls `USDC.transferFrom` after verifying the signature.
- **Mock_Mode**: `PAYMENT_MODE=mock` or `PAYMENT_MODE=hybrid` — all gateway components short-circuit.
- **Circuit_Breaker**: Failure counter in `x402-client.ts` that downgrades a vendor to `x402-degraded` after 3 failures.

## Requirements

### Requirement 1: withX402 Middleware — Core Payment Enforcement

**User Story:** As a vendor API developer, I want to protect any Next.js route with a single wrapper call,
so that callers without a valid payment are automatically challenged with HTTP 402.

#### Acceptance Criteria

1. THE withX402 SHALL accept an `X402Config` object and a Next.js App Router handler and return a new handler that enforces payment.
2. WHEN an incoming request does not contain an `X-Payment` header, THE withX402 SHALL generate a UUID nonce server-side, persist a `NonceRecord` with status `pending`, and return HTTP 402 with a `WWW-Authenticate: x402` header and a JSON body containing `amount`, `payTo`, `nonce`, `expiry`, `asset`, and `network`.
3. WHEN generating a nonce, THE withX402 SHALL set `NonceRecord.expiresAt` to at most `issuedAt + 300` seconds regardless of the `nonceTtlSeconds` value in the config.
4. WHEN an incoming request contains an `X-Payment` header, THE withX402 SHALL extract the `X-Request-Id` header as `correlationId` (generating a UUID if absent) and create a `PaymentIntent` with status `CREATED`.
5. WHEN creating a `PaymentIntent`, THE withX402 SHALL immediately transition it to `VERIFYING` before calling the Facilitator.
6. WHEN the Facilitator returns `verified: true`, THE withX402 SHALL call the wrapped handler, set `PaymentIntent` status to `SETTLED`, attach `X-Payment-Response` and `X-Correlation-Id` headers to the response, and return the handler's response.
7. WHEN the Facilitator returns `verified: false`, THE withX402 SHALL set `PaymentIntent` status to `FAILED` with the `reason` and return HTTP 402.
8. WHEN an `Idempotency-Key` header is present and a `PaymentIntent` with that key exists with status `SETTLED`, THE withX402 SHALL return the cached 200 response without re-verifying.
9. WHEN an `Idempotency-Key` header is present and a `PaymentIntent` with that key exists with status `VERIFYING`, THE withX402 SHALL return HTTP 409 Conflict.
10. WHEN an `Idempotency-Key` header is present and a `PaymentIntent` with that key exists with status `FAILED`, THE withX402 SHALL allow the retry to proceed normally.

### Requirement 2: Mock Mode Short-Circuit

**User Story:** As a developer working locally, I want all x402 gateway components to be invisible when
`PAYMENT_MODE` is `mock` or `hybrid`, so that my existing development workflow is unchanged.

#### Acceptance Criteria

1. WHILE `PAYMENT_MODE` is `mock` or `hybrid`, THE withX402 SHALL call the wrapped handler directly and return its response without any payment check, nonce creation, or DB write.
2. WHILE `PAYMENT_MODE` is `mock` or `hybrid`, THE withX402 SHALL include `mock: true` in the response body.
3. WHILE `PAYMENT_MODE` is `mock` or `hybrid`, THE Facilitator SHALL return a mock verified response if called without performing signature verification or on-chain calls.
4. WHILE `PAYMENT_MODE` is `mock` or `hybrid`, THE Gateway SHALL NOT write any `NonceRecord`, `PaymentRecord`, or `PaymentIntent` rows to the database.
5. WHERE `GATEWAY_MOCK_VERIFY` is set to `true`, THE Facilitator SHALL accept any non-empty `X-Payment` header and return `verified: true` without performing signature verification or on-chain settlement.

### Requirement 3: Facilitator — EIP-712 Signature Verification

**User Story:** As a gateway operator, I want the Facilitator to cryptographically verify every payment
authorization before granting access, so that only legitimate signed payments are accepted.

#### Acceptance Criteria

1. THE Facilitator SHALL expose `POST /api/x402/verify` and validate the request body against a Zod schema requiring `paymentHeader`, `resource`, `amountUsdc`, `payTo`, `nonce`, `network`, `correlationId`, and `confirmations`.
2. WHEN a verify request arrives, THE Facilitator SHALL validate the `X-Gateway-Token` HMAC-SHA256 header using `GATEWAY_INTERNAL_SECRET` and return HTTP 401 if the token is missing or invalid.
3. WHEN verifying a payment, THE Facilitator SHALL decode the base64url `paymentHeader` into `{ signature, authorization: PaymentAuthorization }`.
4. WHEN verifying a payment, THE Facilitator SHALL use `recoverTypedDataAddress` from viem to recover the signer address from the EIP-712 typed data and return `verified: false` with `reason: "invalid_signature"` if the recovered address does not match `authorization.payer`.
5. WHEN verifying a payment, THE Facilitator SHALL verify that `authorization.amount` exactly equals `config.amountUsdc` using string equality and return `verified: false` with `reason: "amount_mismatch"` if they differ.
6. WHEN verifying a payment, THE Facilitator SHALL verify that `authorization.resource` matches the actual request resource URL and return `verified: false` with `reason: "resource_mismatch"` if they differ.
7. WHEN verifying a payment, THE Facilitator SHALL verify that `authorization.payTo` matches the configured receiver address and return `verified: false` with `reason: "payto_mismatch"` if they differ.
8. WHEN verification succeeds, THE Facilitator SHALL echo `correlationId` in the response body and in a `X-Correlation-Id` response header.
9. THE Facilitator SHALL include `correlationId` in every log line it emits.
10. THE Facilitator SHALL write exactly one `AuditLog` entry per call — one of `x402.payment_verified`, `x402.payment_failed`, `x402.replay_blocked`, or `x402.settlement_failed` — with `correlationId` in the metadata.

### Requirement 4: Nonce Registry — Replay Attack Prevention

**User Story:** As a gateway operator, I want every payment nonce to be consumable exactly once, so that
a captured `X-Payment` header cannot be replayed to obtain free access.

#### Acceptance Criteria

1. THE Nonce_Registry SHALL generate every nonce as a server-side UUID v4; client-provided nonces SHALL NOT be accepted.
2. WHEN a 402 response is issued, THE Nonce_Registry SHALL persist a `NonceRecord` with `status: "pending"`, `nonce`, `resource`, `amountUsdc`, `payTo`, `network`, and `expiresAt` (capped at `issuedAt + 300s`).
3. WHEN a nonce is consumed, THE Nonce_Registry SHALL perform the `pending → used` transition inside a single atomic DB transaction and return `false` if any concurrent request has already consumed the same nonce.
4. WHEN the Facilitator receives a nonce that is already `used`, THE Facilitator SHALL return `verified: false` with `reason: "nonce_used"` and write an `AuditLog` entry `x402.replay_blocked`.
5. WHEN the Facilitator receives a nonce that is `expired` or past `expiresAt`, THE Facilitator SHALL return `verified: false` with `reason: "nonce_expired"`.
6. WHEN a nonce has been `used`, THE Nonce_Registry SHALL NOT allow it to transition back to `pending`.
7. THE nonce cleanup cron at `POST /api/gateway/nonces/cleanup` SHALL mark all `NonceRecord` rows with `expiresAt < now()` and `status: "pending"` as `expired` and SHALL run at least every 5 minutes.
8. WHEN a nonce is bound to a specific `resource`, `amountUsdc`, and `payTo`, THE Facilitator SHALL reject a payment that presents the nonce for a different `resource`, `amountUsdc`, or `payTo`.

### Requirement 5: Settlement Engine — On-Chain USDC Verification

**User Story:** As a gateway operator, I want the Settlement Engine to confirm USDC payment on-chain before
granting access, so that only transactions with real on-chain settlement are accepted.

#### Acceptance Criteria

1. THE Settlement_Engine SHALL support two modes — `pre-signed` and `facilitator` — selected by the `SETTLEMENT_MODE` environment variable.
2. WHILE operating in `pre-signed` mode, THE Settlement_Engine SHALL call `publicClient.getLogs` for `USDC.Transfer` events from `authorization.payer` to `authorization.payTo` within the nonce window and return `verified: false` with `reason: "transfer_not_found"` if no matching event is found.
3. WHILE operating in `facilitator` mode, THE Settlement_Engine SHALL call `walletClient.writeContract` using `GATEWAY_PRIVATE_KEY` to execute `USDC.transferFrom(payer, payTo, amount)` and return `verified: false` with `reason: "settlement_failed"` if the call reverts.
4. WHEN comparing USDC amounts, THE Settlement_Engine SHALL use `parseUnits(amountUsdc, 6)` from viem for all BigInt conversions and SHALL NOT use `parseFloat` or floating-point multiplication.
5. WHEN `confirmations` is greater than 0, THE Settlement_Engine SHALL call `publicClient.waitForTransactionReceipt({ confirmations, timeout: GATEWAY_SETTLEMENT_TIMEOUT_MS })` before returning `confirmed`.
6. WHEN `confirmations` is 0, THE Settlement_Engine SHALL accept the Transfer log on first sight without waiting for block confirmations.
7. THE Settlement_Engine SHALL resolve chain RPC URLs exclusively from `getChainConfig(chainId)` and SHALL NOT hardcode any RPC URL, chain ID, or USDC contract address.
8. WHEN settlement succeeds, THE Settlement_Engine SHALL return a `SettlementResult` containing `txHash`, `confirmedAt`, `mode`, and `blockNumber`.
9. THE Settlement_Engine SHALL include `correlationId` in every log line it emits.

### Requirement 6: EIP-712 Signer — Agent-Side Payment Authorization

**User Story:** As an AI agent, I want to sign a structured payment authorization using my on-chain private
key, so that the Facilitator can cryptographically verify I authorized the exact payment.

#### Acceptance Criteria

1. THE EIP712_Signer SHALL construct a `PaymentAuthorization` struct containing `payer`, `payTo`, `asset`, `network`, `amount`, `amountAtomicUnits`, `resource`, `nonce`, and `expiry`.
2. WHEN building the EIP-712 domain, THE EIP712_Signer SHALL set `name: "PraxisX402"`, `version: "1"`, and `chainId` resolved from `getChainConfig()` and SHALL NOT hardcode any chain ID inside this file.
3. THE EIP712_Signer SHALL derive `amountAtomicUnits` using `parseUnits(amount, 6)` from viem and SHALL NOT use `parseFloat` or floating-point arithmetic.
4. WHEN signing, THE EIP712_Signer SHALL call viem `signTypedData` with `AGENT_PRIVATE_KEY` and return a base64url-encoded string of `JSON({ signature, authorization })`.
5. THE EIP712_Signer SHALL keep `AGENT_PRIVATE_KEY` exclusively on the server side and SHALL NOT expose it to any client-side context.
6. WHEN the signed payload is decoded and passed to `recoverTypedDataAddress`, THE result SHALL equal `privateKeyToAddress(AGENT_PRIVATE_KEY)`.

### Requirement 7: Chain Configuration Registry

**User Story:** As a developer adding multi-chain support, I want a single file to be the authoritative
source of all chain-specific values, so that no other file ever hardcodes a chain ID or contract address.

#### Acceptance Criteria

1. THE Chain_Config SHALL export `getChainConfig(chainId?: number): ChainConfig`, `getDefaultChain(): ChainConfig`, and `SUPPORTED_CHAINS: Record<number, ChainConfig>`.
2. THE Chain_Config SHALL support Base Sepolia (chainId 84532) as the default chain and Base Mainnet (chainId 8453) as an opt-in chain.
3. WHEN `DEFAULT_CHAIN_ID` environment variable is set, THE `getDefaultChain()` function SHALL return the config for that chain ID.
4. IF an unsupported `chainId` is requested, THEN THE Chain_Config SHALL throw a descriptive error identifying the unsupported chain ID.
5. THE Chain_Config `ChainConfig` type SHALL include `chainId`, `caip2`, `name`, `rpcUrl`, `usdcAddress`, `explorerUrl`, `registryAddress`, and `blockTimeMs`.
6. THE `rpcUrl` in every `ChainConfig` entry SHALL be resolved from an environment variable and SHALL NOT be a hardcoded string literal.
7. WHEN any gateway component needs a chain ID, USDC address, or explorer URL, THE component SHALL import from `Chain_Config` and SHALL NOT define these values locally.

### Requirement 8: PaymentIntent Lifecycle Tracker

**User Story:** As a gateway operator, I want every payment attempt to be tracked through a defined lifecycle,
so that I can diagnose failures and detect abandoned payments without polluting the database with noise.

#### Acceptance Criteria

1. THE PaymentIntent SHALL have exactly four valid statuses: `CREATED`, `VERIFYING`, `SETTLED`, and `FAILED`.
2. THE Gateway SHALL only create a `PaymentIntent` row when an `X-Payment` header is present in the request — a 402 response issued without an `X-Payment` header SHALL NOT write any `PaymentIntent` row.
3. WHEN a `PaymentIntent` transitions to `SETTLED`, THE Gateway SHALL set `settledAt` to the current timestamp and SHALL populate `paymentRecordId` with the ID of the corresponding `PaymentRecord`.
4. WHEN a `PaymentIntent` transitions to `FAILED`, THE Gateway SHALL set `failedAt` to the current timestamp and populate `failureReason` with a descriptive string.
5. THE Gateway SHALL NOT allow a `PaymentIntent` to transition from `SETTLED` or `FAILED` to any other status.
6. WHEN a `PaymentIntent` carries an `idempotencyKey`, THE Gateway SHALL enforce uniqueness at the database level via a unique index on `PaymentIntent.idempotencyKey`.
7. WHEN a `PaymentIntent` is created, THE Gateway SHALL store `correlationId` (from the `X-Request-Id` header or auto-generated) in `PaymentIntent.correlationId`.
8. THE nonce cleanup cron SHALL mark `NonceRecord` rows as `expired` for all nonces past `expiresAt` that have no corresponding `PaymentIntent` row, without writing any `PaymentIntent` row for abandoned 402s.

### Requirement 9: Amount Integrity — No Floating-Point Arithmetic

**User Story:** As a gateway operator, I want all payment amounts to be stored and compared as strings with
BigInt arithmetic, so that floating-point precision errors can never cause incorrect settlement amounts.

#### Acceptance Criteria

1. THE Gateway SHALL store `amountUsdc` in `NonceRecord`, `PaymentRecord`, `PaymentIntent`, `EndpointConfig`, and `PolicyConfig` as a `String` field and SHALL NOT use a `Float` column type for any amount.
2. WHEN converting a USDC human-readable amount to atomic units, THE Gateway SHALL use `parseUnits(amountUsdc, 6)` from viem and SHALL NOT use `parseFloat`, `Number()`, or `* 1_000_000` for this conversion.
3. WHEN comparing the amount in a `PaymentAuthorization` to the configured `EndpointConfig.amountUsdc`, THE Facilitator SHALL use string equality and SHALL NOT convert either value to a floating-point number for the comparison.
4. WHEN comparing a USDC Transfer event amount to the expected amount, THE Settlement_Engine SHALL compare BigInt values derived from `parseUnits` and SHALL NOT compare floating-point intermediaries.
5. THE `amountAtomicUnits` field in `PaymentRecord` and `PaymentAuthorization` SHALL be derived by `parseUnits(amountUsdc, 6).toString()` — a lossless, exact conversion with no float intermediary.

### Requirement 10: Atomic Settlement Transaction

**User Story:** As a gateway operator, I want the nonce consumption, payment record creation, and intent
settlement to happen atomically, so that a partial failure can never leave a nonce consumed but no record written.

#### Acceptance Criteria

1. WHEN the Facilitator confirms settlement, THE Gateway SHALL execute the following operations in a single Prisma DB transaction: mark `NonceRecord.status = "used"`, insert `PaymentRecord`, and update `PaymentIntent.status = "SETTLED"`.
2. IF the DB transaction in the settlement step fails, THEN THE Facilitator SHALL roll back all three operations, return `verified: false`, and write an `AuditLog` entry `x402.settlement_failed`.
3. WHEN two concurrent verify requests arrive with the same nonce, THE Gateway SHALL allow only one DB transaction to succeed; the second SHALL receive a rejection and return `verified: false` with `reason: "nonce_used"`.
4. WHEN settlement succeeds, THE `PaymentRecord.nonce` and `PaymentRecord.paymentIntentId` SHALL reference the `NonceRecord` and `PaymentIntent` written in the same transaction.

### Requirement 11: x402 Client — Agent-Side Retry and Circuit Breaker

**User Story:** As a Praxis agent, I want the x402 client to automatically handle the 402 → sign → retry
cycle and degrade gracefully when the Facilitator is unavailable, so that the agent workflow never deadlocks.

#### Acceptance Criteria

1. WHEN `PAYMENT_MODE` is `x402`, THE `x402-client.ts` SHALL execute the full cycle: issue an unauthenticated GET to obtain the 402 response body, call `EIP712_Signer.signPaymentAuthorization` with the nonce and payment parameters, and retry the request with the `X-Payment` header.
2. WHEN a 200 response is received after payment, THE `x402-client.ts` SHALL extract the `X-Payment-Response` header and construct a `PaymentReceipt` with `mode: "x402"` and the `txHash`.
3. IF the Facilitator does not respond within 6 seconds, THEN THE `x402-client.ts` SHALL fall back to `buildMockReceipt(intent, { mode: "hybrid" })` and return that receipt without retrying.
4. WHEN the Facilitator fails or times out, THE `x402-client.ts` SHALL increment the failure counter for the vendor key.
5. WHEN a vendor's failure counter reaches 3, THE `x402-client.ts` SHALL mark the vendor as `x402-degraded` and route subsequent payments for that vendor through hybrid mode without attempting x402.
6. IF the Facilitator returns `verified: false` with `reason: "invalid_signature"` or `reason: "amount_mismatch"`, THEN THE `x402-client.ts` SHALL throw `PaymentVerificationError` and set the run status to `failed`.
7. WHEN a successful payment completes, THE `x402-client.ts` SHALL call `runStore.setPayment(runId, receipt)` with the returned `PaymentReceipt`.

### Requirement 12: Firewall Precedence and Pipeline Integration

**User Story:** As a Praxis platform user, I want the existing payment firewall to run before any x402
payment is initiated, so that budget and policy guards cannot be bypassed by the x402 protocol.

#### Acceptance Criteria

1. THE `payment-executor.ts` SHALL call `runPaymentFirewall()` and receive `{ approved: true }` before invoking `x402-client.ts` for any x402 payment.
2. WHEN `runPaymentFirewall()` returns `{ approved: false }`, THE `payment-executor.ts` SHALL NOT call `x402-client.ts` and SHALL set the run status to `failed`.
3. WHEN a successful `PaymentReceipt` is returned from `x402-client.ts`, THE `run-store.ts` SHALL link the `PaymentRecord.runId` to the corresponding `Run` row.
4. WHEN a run includes an x402 payment, THE `AuditLog` SHALL contain the `correlationId` from the x402 payment in the run's audit entries.

### Requirement 13: Async Webhook Queue

**User Story:** As a vendor integrating with Praxis, I want to receive webhook notifications when payments
are settled or fail, so that I can trigger downstream fulfillment without polling the gateway.

#### Acceptance Criteria

1. WHEN a payment is settled, the Facilitator verifier fails, a replay is blocked, or an intent expires, THE Webhook_Queue SHALL enqueue a `WebhookDelivery` row with the event type and payload without blocking the payment response.
2. THE Webhook_Queue SHALL support the following event types: `x402.payment.settled`, `x402.payment.failed`, `x402.replay.blocked`, and `x402.intent.expired`.
3. WHEN delivering a webhook, THE Webhook_Queue worker SHALL attach an `X-Praxis-Signature` header containing an HMAC-SHA256 signature computed from the delivery payload and the endpoint's stored secret.
4. WHEN a webhook delivery fails, THE Webhook_Queue worker SHALL retry with the following backoff schedule: 1 minute, 5 minutes, 30 minutes, and 2 hours — for a maximum of 4 attempts.
5. WHEN a webhook has exhausted all retry attempts, THE Webhook_Queue worker SHALL set `WebhookDelivery.status = "dead"`.
6. THE webhook worker at `POST /api/gateway/webhooks/process` SHALL be triggered by a cron schedule no less frequent than every 30 seconds.
7. THE `enqueueWebhook` function SHALL write a `WebhookDelivery` row and return immediately — it SHALL NOT await delivery completion.

### Requirement 14: Correlation ID — End-to-End Tracing

**User Story:** As a gateway operator investigating a payment issue, I want a single ID that threads through
every component, so that I can reconstruct the full lifecycle from 402 issuance to webhook delivery.

#### Acceptance Criteria

1. WHEN a request arrives with an `X-Request-Id` header, THE withX402 SHALL use that value as the `correlationId`; WHEN the header is absent, THE withX402 SHALL generate a UUID and use it as the `correlationId`.
2. THE `correlationId` SHALL be stored in `PaymentIntent.correlationId` when the intent is created.
3. THE Facilitator SHALL include `correlationId` in every `AuditLog.metadata` entry it writes.
4. THE Settlement_Engine SHALL receive `correlationId` as a parameter and include it in every log line.
5. THE Webhook_Queue SHALL store `correlationId` in the `WebhookDelivery` payload.
6. WHEN the Facilitator returns a response, THE response body SHALL include a `correlationId` field and the response headers SHALL include `X-Correlation-Id`.
7. THE withX402 SHALL forward the `X-Correlation-Id` response header received from the Facilitator to the final API response.

### Requirement 15: Gateway API Routes and Endpoint Configuration

**User Story:** As a gateway operator, I want a set of API routes to register protected endpoints and
inspect payment history, so that I can manage the gateway programmatically.

#### Acceptance Criteria

1. THE Gateway SHALL expose `GET /api/gateway/endpoints` and `POST /api/gateway/endpoints` requiring `key:manage` scope for listing and creating `EndpointConfig` records.
2. THE Gateway SHALL expose `PATCH /api/gateway/endpoints/[id]` and `DELETE /api/gateway/endpoints/[id]` requiring `key:manage` scope for updating and deactivating `EndpointConfig` records.
3. WHEN creating an `EndpointConfig`, THE Gateway SHALL validate that `amountUsdc` is a valid decimal string and SHALL NOT accept a numeric type.
4. THE Gateway SHALL expose `GET /api/gateway/payments` and `GET /api/gateway/payments/[id]` requiring `key:manage` scope for paginated payment history and per-payment detail.
5. THE Gateway SHALL expose `GET /api/gateway/analytics` requiring `key:manage` scope and SHALL return total revenue USDC, success rate, average settlement time, replays blocked, and pending intent count — all computed from DB aggregates.
6. THE Gateway SHALL expose `GET /api/gateway/intents` requiring `key:manage` scope for a paginated `PaymentIntent` list with lifecycle state.
7. WHEN `POST /api/gateway/nonces/cleanup` is called, THE Gateway SHALL mark all expired `NonceRecord` rows and return the count of rows updated.
8. THE Gateway SHALL rate-limit `POST /api/x402/verify` at 60 requests per minute per IP using the existing `rateLimit` utility.

### Requirement 16: Gateway Dashboard UI

**User Story:** As a gateway operator, I want a browser dashboard showing payment KPIs, history, and
webhook logs, so that I can monitor the gateway and diagnose issues without querying the database directly.

#### Acceptance Criteria

1. THE Gateway_Dashboard at `app/gateway/page.tsx` SHALL display the following KPI cards: total revenue (USDC), success rate (%), average settlement time, replay attacks blocked, and pending intent count — all sourced from live DB aggregates.
2. THE Gateway_Dashboard SHALL include a payment history section at `app/gateway/payments/page.tsx` with pagination.
3. THE Gateway_Dashboard SHALL include a PaymentIntent lifecycle view at `app/gateway/intents/page.tsx` showing each intent's current status and timestamps.
4. THE Gateway_Dashboard SHALL include an endpoint configuration page at `app/gateway/endpoints/page.tsx` for managing `EndpointConfig` records.
5. THE Gateway_Dashboard SHALL include a webhook delivery log at `app/gateway/webhooks/page.tsx` showing delivery status and retry history per event.
6. THE KPI metric "success rate" SHALL be calculated as `SETTLED / CREATED * 100` for a rolling 24-hour window.
7. THE KPI metric "replay attacks blocked" SHALL be sourced from `COUNT(AuditLog WHERE action = "x402.replay_blocked")` for a rolling 24-hour window.

### Requirement 17: Facilitator Internal Endpoint Security

**User Story:** As a gateway operator, I want the Facilitator to reject any request not originating from
the withX402 middleware, so that external callers cannot submit arbitrary payment headers to the verifier.

#### Acceptance Criteria

1. THE Facilitator SHALL require an `X-Gateway-Token` header on every request to `POST /api/x402/verify`.
2. WHEN validating `X-Gateway-Token`, THE Facilitator SHALL compute `HMAC-SHA256(GATEWAY_INTERNAL_SECRET, nonce)` and compare it to the header value using a constant-time comparison; THE Facilitator SHALL return HTTP 401 if the comparison fails.
3. THE `GATEWAY_INTERNAL_SECRET` SHALL be a randomly-generated 32-byte hex value stored exclusively in server-side environment variables.
4. THE withX402 SHALL generate and attach the `X-Gateway-Token` to every internal call to `POST /api/x402/verify`.
5. WHEN `PAYMENT_MODE` is `mock` or `hybrid`, THE Facilitator SHALL still validate the `X-Gateway-Token` if one is provided, but MAY return a mock success response without performing cryptographic verification.

### Requirement 18: Prisma Schema — New Data Models

**User Story:** As a backend developer, I want the required Prisma models with correct indexes and
constraints, so that the gateway layer persists data efficiently and enforces invariants at the DB level.

#### Acceptance Criteria

1. THE `NonceRecord` model SHALL include fields: `id`, `nonce` (unique), `resource`, `amountUsdc`, `payTo`, `network`, `status` (default `"pending"`), `issuedAt`, `expiresAt`, `usedAt`, `usedByTx`, and `ipAddress`, with indexes on `nonce`, `status`, and `expiresAt`.
2. THE `PaymentRecord` model SHALL include fields: `id`, `nonce` (unique), `paymentIntentId` (unique), `resource`, `payerAddress`, `payTo`, `amountUsdc`, `amountAtomicUnits`, `asset`, `network`, `chainId`, `signature`, `txHash`, `settlementMode`, `verifiedAt`, `tenantId`, and `runId`, with indexes on `resource`, `payerAddress`, `verifiedAt`, and `tenantId`.
3. THE `PaymentIntent` model SHALL include fields: `id`, `nonce` (unique), `correlationId`, `idempotencyKey` (unique), `resource`, `amountUsdc`, `payTo`, `payerAddress`, `chainId`, `status`, `failureReason`, `paymentRecordId`, `createdAt`, `verifyingAt`, `settledAt`, `failedAt`, and `expiresAt`, with indexes on `nonce`, `status`, `resource`, `createdAt`, and `correlationId`.
4. THE `EndpointConfig` model SHALL include fields: `id`, `resource` (unique), `amountUsdc`, `description`, `payTo`, `asset`, `network`, `chainId`, `nonceTtlSeconds` (default 300), `isActive` (default true), `tenantId`, `createdAt`, and `updatedAt`, with indexes on `resource` and `tenantId`.
5. THE `PolicyConfig` model SHALL be extended with `allowX402Gateway` (Boolean, default true), `x402SettlementMode` (String, default `"pre-signed"`), and `x402MaxAmountUsdc` (String, default `"100.00"`).
6. IF `x402MaxAmountUsdc` was previously stored as a `Float` column, THEN THE migration SHALL convert it to a `String` column; amount comparisons SHALL continue to use string parsing and BigInt arithmetic.

### Requirement 19: Error Handling and Fallback Behaviors

**User Story:** As a Praxis platform operator, I want all error conditions in the x402 flow to have defined
responses and recovery paths, so that no error leaves the system in an indeterminate state.

#### Acceptance Criteria

1. WHEN the Facilitator is unreachable or does not respond within 6 seconds, THE `x402-client.ts` SHALL return `buildMockReceipt(intent, { mode: "hybrid" })` and write `AuditLog: "x402.settlement_failed"`.
2. WHEN signature verification fails, THE Facilitator SHALL return `{ verified: false, reason: "invalid_signature" }` and THE `x402-client.ts` SHALL throw `PaymentVerificationError`, causing the run to transition to `failed`.
3. WHEN a nonce is expired and an agent retries from scratch, THE agent SHALL be able to obtain a fresh 402 response with a new nonce and retry the full payment cycle.
4. WHEN the amount in the signed payload does not match the endpoint's configured amount, THE Facilitator SHALL return `{ verified: false, reason: "amount_mismatch" }` and THE `x402-client.ts` SHALL throw `PaymentVerificationError`.
5. WHEN `USDC.getLogs` finds no matching Transfer event in `pre-signed` mode, THE Facilitator SHALL return `{ verified: false, reason: "transfer_not_found" }`.
6. WHEN `USDC.transferFrom` reverts in `facilitator` mode, THE Settlement_Engine SHALL return an error and THE Facilitator SHALL write `AuditLog: "x402.settlement_failed"`.
7. WHEN `HITL_THRESHOLD_USDC` is set and the x402 payment amount exceeds it, THE run SHALL transition to `awaiting_approval` after a `transfer_not_found` scenario, following the existing HITL flow.

### Requirement 20: Confirmation Policy and Block Finality

**User Story:** As a gateway operator setting up high-value endpoints, I want to configure how many block
confirmations to require before accepting a payment, so that I can balance speed against settlement finality.

#### Acceptance Criteria

1. THE `X402Config` SHALL include a `confirmations` field (default 1) that controls how many block confirmations the Settlement_Engine waits for before returning `verified: true`.
2. WHEN `confirmations` is 0, THE Settlement_Engine SHALL accept the Transfer log on first sight without calling `waitForTransactionReceipt`.
3. WHEN `confirmations` is 1 or greater, THE Settlement_Engine SHALL call `publicClient.waitForTransactionReceipt({ confirmations, timeout: GATEWAY_SETTLEMENT_TIMEOUT_MS })`.
4. WHEN `confirmations` is 2 or greater and the configured chain's `blockTimeMs` multiplied by `confirmations` would exceed `GATEWAY_SETTLEMENT_TIMEOUT_MS`, THE Settlement_Engine SHALL log a warning including the chain name, requested confirmations, and estimated wait time.
5. THE `GATEWAY_SETTLEMENT_TIMEOUT_MS` environment variable SHALL override the default timeout of 30000 ms used in `waitForTransactionReceipt`.
6. THE `VerifyRequest` sent from withX402 to the Facilitator SHALL include the `confirmations` value from `X402Config`.
