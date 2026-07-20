# Praxis — Full Product Roadmap

> **What this doc is:** A complete specification of every feature that needs to be built for Praxis to be a production-grade blockchain payment gateway with wallet, auth, history, and admin. Each section details what exists today, what needs to be built, the exact files to create/modify, and the data model changes required.
>
> **Last updated:** 2026-07-20
> **Current status:** MVP core complete. See `CONTEXT.md` for what's already built.

---

## Table of Contents

1. [User Auth & Profile](#1-user-auth--profile)
2. [Wallet Connect & Management](#2-wallet-connect--management)
3. [Transaction History](#3-transaction-history)
4. [Payment Gateway — Merchant Side](#4-payment-gateway--merchant-side)
5. [Send & Receive UI](#5-send--receive-ui)
6. [Token & Balance Management](#6-token--balance-management)
7. [Stablecoins & Programmable Payments](#7-stablecoins--programmable-payments)
8. [DeFi / Swap](#8-defi--swap)
9. [Security Layer Enhancements](#9-security-layer-enhancements)
10. [On-chain Proof & Compliance](#10-on-chain-proof--compliance)
11. [Notifications](#11-notifications)
12. [Admin Dashboard UI](#12-admin-dashboard-ui)
13. [Analytics](#13-analytics)
14. [Smart Contract Upgrades](#14-smart-contract-upgrades)
15. [Multi-chain Expansion](#15-multi-chain-expansion)
16. [Build Priority Order](#16-build-priority-order)

---

## 1. User Auth & Profile

### Current State
- No `User` model in Prisma. No login/signup pages. No sessions.
- Auth is M2M only — SHA-256-hashed Bearer tokens (API keys) for machine agents.
- `middleware.ts` applies security headers but does **not** protect any page routes.

### What Needs to Be Built

#### 1.1 Prisma — Add User Model
**File:** `prisma/schema.prisma`

Add the following model:
```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String                        // bcrypt, cost factor 12
  name         String?
  avatarUrl    String?
  role         String    @default("user")    // "user" | "admin"
  tenantId     String?                       // optional org linkage
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  lastLoginAt  DateTime?

  tenant  Tenant?   @relation(fields: [tenantId], references: [id])
  runs    Run[]                              // runs initiated by this user
  sessions Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique               // SHA-256 of raw session token
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([token])
  @@index([userId])
}
```

Also add `userId String?` to the `Run` model and a `userId` relation.

Run migration: `npx prisma migrate dev --name add_users_sessions`

---

#### 1.2 Auth Library
**New file:** `src/lib/auth/session.ts`

- `createSession(userId, ip, userAgent)` — generates `crypto.randomBytes(32)` token, stores SHA-256 hash, returns raw token
- `resolveSession(rawToken)` — hashes incoming token, DB lookup, checks expiry
- `deleteSession(rawToken)` — logout
- `deleteAllUserSessions(userId)` — logout everywhere

**New file:** `src/lib/auth/password.ts`
- `hashPassword(plain)` — bcrypt, cost 12
- `verifyPassword(plain, hash)` — bcrypt compare

---

#### 1.3 Auth API Routes
**New files:**

`app/api/auth/signup/route.ts` — `POST`
- Body: `{ email, password, name? }`
- Validate email format, password min 8 chars
- Check email not already taken
- Hash password, create User, create Session
- Set `Set-Cookie: praxis_session=<rawToken>; HttpOnly; SameSite=Strict; Path=/`
- Return: `{ user: { id, email, name, role } }`

`app/api/auth/login/route.ts` — `POST`
- Body: `{ email, password }`
- Resolve user by email, verify password
- Create session, set cookie
- Write AuditLog `user.login`
- Return: `{ user: { id, email, name, role } }`

`app/api/auth/logout/route.ts` — `POST`
- Read session cookie, delete session
- Clear cookie
- Write AuditLog `user.logout`

`app/api/auth/me/route.ts` — `GET`
- Read session cookie → resolve user
- Return: `{ user: { id, email, name, role, tenantId, createdAt, lastLoginAt } }`

`app/api/auth/password/route.ts` — `PATCH`
- Body: `{ currentPassword, newPassword }`
- Verify current, hash new, update DB
- Invalidate all other sessions

---

#### 1.4 Middleware — Protect Page Routes
**File:** `middleware.ts` — extend existing

Add route protection:
- `/profile*` → redirect to `/login` if no valid session cookie
- `/admin*` → redirect to `/login` if not `role: admin`
- `/api/auth/*` → always allow (public)
- Keep all existing security headers

---

#### 1.5 Pages
**New files:**

`app/login/page.tsx`
- Email + password form
- "Remember me" checkbox
- Link to signup
- Error states (invalid credentials, account disabled)
- Redirect to `/` on success

`app/signup/page.tsx`
- Name, email, password, confirm password
- Password strength indicator
- Terms acceptance checkbox
- Redirect to `/` on success

`app/profile/page.tsx`
- Avatar (initials fallback), name, email display
- Edit name field (inline save)
- Change password form
- Linked wallets section (see §2)
- Run history section (see §3)
- Session list (active sessions, revoke individual)
- Danger zone: delete account

---

## 2. Wallet Connect & Management

### Current State
- `viem` is installed and used server-side for RPC calls and contract interactions.
- No wallet connect UI. No browser wallet integration. No user-facing address management.
- `src/blockchain/registry-client.ts` uses a server-side private key (`AGENT_PRIVATE_KEY`) to sign transactions.

### What Needs to Be Built

#### 2.1 Prisma — Wallet Model
**File:** `prisma/schema.prisma`

```prisma
model Wallet {
  id           String   @id @default(cuid())
  userId       String
  address      String                        // checksummed EVM address
  chainId      Int                           // 84532 = Base Sepolia, 1 = Mainnet, etc.
  label        String?                       // user-set nickname e.g. "My MetaMask"
  walletType   String   @default("injected") // "injected" | "walletconnect" | "coinbase" | "ledger"
  isDefault    Boolean  @default(false)
  isPrimary    Boolean  @default(false)
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, address, chainId])
  @@index([userId])
}
```

Run migration: `npx prisma migrate dev --name add_wallets`

---

#### 2.2 Install Dependencies
```bash
npm install @rainbow-me/rainbowkit wagmi @tanstack/react-query
```

- **RainbowKit** — wallet connect modal (MetaMask, WalletConnect, Coinbase Wallet)
- **wagmi** — React hooks for wallet state, balance, contract calls
- **@tanstack/react-query** — required peer dependency for wagmi

---

#### 2.3 Wagmi Provider Setup
**New file:** `src/lib/wagmi/config.ts`
- Configure supported chains: Base Sepolia (`84532`), Base Mainnet (`8453`)
- Configure transports (HTTP RPC with `BASE_SEPOLIA_RPC_URL` env)
- Configure connectors: MetaMask, WalletConnect, Coinbase Wallet

**File:** `app/layout.tsx` — wrap `<body>` with `<WagmiProvider>`, `<QueryClientProvider>`, `<RainbowKitProvider>`

---

#### 2.4 Wallet API Routes

`app/api/wallets/route.ts` — `GET` / `POST`
- GET: list user's linked wallets (requires session auth)
- POST: link a new wallet — body `{ address, chainId, walletType, label? }`
  - Verify signature: user must sign a challenge message to prove ownership
  - Challenge: `Sign to link wallet to Praxis. Nonce: <random>. Timestamp: <unix>`

`app/api/wallets/[walletId]/route.ts` — `PATCH` / `DELETE`
- PATCH: update label, set as default
- DELETE: unlink wallet

`app/api/wallets/challenge/route.ts` — `POST`
- Returns a nonce + timestamp for wallet ownership proof
- Stored in session for verification

---

#### 2.5 UI Components

**New file:** `components/wallet-connect-button.tsx`
- RainbowKit `<ConnectButton />` styled to match Praxis dark theme
- Shows address (ENS-resolved if available), network, avatar
- Dropdown: copy address, switch network, disconnect

**New file:** `components/wallet-manager.tsx`
- List of linked wallets with type icon, address (truncated), network badge
- Default wallet indicator
- "Add wallet" button → triggers RainbowKit modal + signature flow
- Remove wallet (confirm dialog)
- Set as default action

**New file:** `components/address-display.tsx`
- Shared: renders `0x1234…abcd` with copy button and optional BaseScan link
- ENS reverse resolution via `viem`

---

#### 2.6 Network Switching
**New file:** `components/network-badge.tsx`
- Shows current connected network with colored dot
- Click → dropdown to switch chain
- Warns if wallet is on wrong network for a transaction

---

## 3. Transaction History

### Current State
- `Run` model exists with full workflow data — `intentJson`, `quoteJson`, `receiptJson`, `chainAnchorJson`, `proofHash`, `status`
- `RunEvent[]` provides timeline steps per run
- `GET /api/runs` returns all runs but with no user filtering and no pagination
- No UI for browsing past runs — dashboard only shows the current active run

### What Needs to Be Built

#### 3.1 API Enhancements

`GET /api/runs` — extend with query params:
- `?page=1&limit=20` — cursor-based pagination
- `?status=completed|failed|awaiting_approval` — filter by status
- `?from=<ISO>&to=<ISO>` — date range filter
- `?search=<string>` — search prompt text
- `?userId=me` — filter to authenticated user's runs only
- Response shape: `{ runs: Run[], total: number, nextCursor: string | null }`

**New route:** `app/api/runs/export/route.ts` — `GET`
- Query params: same filters as above + `?format=csv|json`
- CSV columns: `id, status, prompt, vendor, amount, createdAt, proofHash, txHash`
- Streams response with `Content-Disposition: attachment`

---

#### 3.2 Run History Page
**New file:** `app/history/page.tsx`

Layout:
- Top: filter bar (status tabs, date picker, search input)
- Table / card list of past runs, newest first
- Each row: status badge, prompt (truncated), vendor, amount, date, proof hash (truncated)
- Click row → opens run detail drawer or navigates to run view

**New file:** `components/run-history-table.tsx`
- Virtualized list for large datasets
- Status badge with color per status (green/red/yellow/muted)
- Amount column with USDC formatting
- Relative timestamps ("2 hours ago") with absolute on hover
- "Load more" or infinite scroll pagination

**New file:** `components/run-detail-drawer.tsx`
- Slides in from right when a history row is clicked
- Full run details: all cards (VendorQuote, PolicyCheck, Proof, Payment, ChainAnchor)
- Timeline of RunEvents
- Re-render of the same components used in the main dashboard
- "View proof on BaseScan" link if anchored

---

#### 3.3 Profile — History Section
**In:** `app/profile/page.tsx`

- Summary stats: total runs, total spend (sum of settled USDC), success rate
- Recent 5 runs as compact cards
- "View all history →" link to `/history`

---

#### 3.4 Run Status Updates (Real-time)
**New file:** `app/api/runs/[runId]/stream/route.ts`
- Server-Sent Events (SSE) endpoint
- Streams `RunEvent` rows as they're written to DB
- Client subscribes while run is in `running` or `awaiting_approval` state
- Replaces the current 1500ms polling interval in `page.tsx`

---

## 4. Payment Gateway — Merchant Side

### Current State
- `POST /api/purchase` accepts a plain-English prompt and runs the full workflow
- Vendor side is a mock (`/api/vendor/quote`) with a hardcoded allowlist
- No invoice/payment-request concept, no merchant portal, no webhook delivery

### What Needs to Be Built

#### 4.1 Prisma — Invoice & Webhook Models
**File:** `prisma/schema.prisma`

```prisma
model Invoice {
  id            String    @id @default(cuid())
  tenantId      String
  createdByUserId String?
  reference     String?                         // merchant's own order ID
  description   String
  amountUsdc    Float
  tokenAddress  String    @default("USDC")      // contract address or symbol
  payToAddress  String                          // merchant wallet
  status        String    @default("pending")   // pending | paid | expired | cancelled
  expiresAt     DateTime?
  paidAt        DateTime?
  paidByAddress String?
  paidInRunId   String?                         // which Run settled this invoice
  paymentLink   String    @unique               // short UUID slug for public URL
  memo          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  webhookDeliveries WebhookDelivery[]
}

model WebhookEndpoint {
  id        String   @id @default(cuid())
  tenantId  String
  url       String
  secret    String                              // HMAC-SHA256 signing secret (stored encrypted)
  events    String   @default("invoice.paid,run.completed,run.failed")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant    Tenant @relation(fields: [tenantId], references: [id])
  deliveries WebhookDelivery[]
}

model WebhookDelivery {
  id             String   @id @default(cuid())
  endpointId     String
  invoiceId      String?
  event          String
  payload        String                        // JSON string
  responseStatus Int?
  responseBody   String?
  attemptCount   Int      @default(0)
  nextRetryAt    DateTime?
  deliveredAt    DateTime?
  createdAt      DateTime @default(now())

  endpoint WebhookEndpoint @relation(fields: [endpointId], references: [id])
  invoice  Invoice?        @relation(fields: [invoiceId], references: [id])
}
```

Run migration: `npx prisma migrate dev --name add_invoices_webhooks`

---

#### 4.2 Invoice API Routes

`app/api/invoices/route.ts` — `GET` / `POST`
- POST: create invoice — body `{ description, amountUsdc, payToAddress, expiresAt?, memo?, reference? }`
- GET: list invoices for tenant (paginated, filterable by status)

`app/api/invoices/[invoiceId]/route.ts` — `GET` / `PATCH` / `DELETE`
- GET: invoice detail (public — used by payment page)
- PATCH: cancel invoice (auth required)
- DELETE: soft delete

`app/api/invoices/[invoiceId]/qr/route.ts` — `GET`
- Returns QR code as PNG (encode payment link URL + amount + address)

**New public page:** `app/pay/[paymentLink]/page.tsx`
- Shows invoice details: description, amount, payTo address (truncated + QR)
- "Pay with wallet" button → triggers RainbowKit connect + USDC transfer
- Real-time status polling — updates to "Confirmed" when payment detected
- Expiry countdown timer

---

#### 4.3 Webhook Delivery System

**New file:** `src/lib/webhooks/deliver.ts`
- `deliverWebhook(tenantId, event, payload)` — finds active endpoints, queues delivery
- Signs payload with `HMAC-SHA256(secret, JSON.stringify(payload))`
- Adds header `X-Praxis-Signature: sha256=<hex>`
- Retry with exponential backoff: 1min → 5min → 30min → 2h (max 4 attempts)
- Writes `WebhookDelivery` row on each attempt

`app/api/admin/tenants/[tenantId]/webhooks/route.ts` — `GET` / `POST`
- Manage webhook endpoints per tenant

Call `deliverWebhook()` from:
- `purchase-workflow.ts` on `run.completed`, `run.failed`
- Invoice payment confirmation handler

---

#### 4.4 Merchant Invoice UI

**New file:** `app/invoices/page.tsx`
- Invoice list with status badges, amounts, dates
- "Create Invoice" button → modal form
- Copy payment link button
- Download QR code

**New file:** `components/invoice-card.tsx`
- Compact invoice summary: reference, description, amount, status, expiry

**New file:** `components/create-invoice-modal.tsx`
- Form: description, amount (USDC), pay-to address (auto-fill from default wallet), expiry, memo
- Preview of payment link before saving

---

## 5. Send & Receive UI

### Current State
- Payments are initiated by the agent workflow, not by the user directly
- No manual send UI, no receive QR, no address book

### What Needs to Be Built

#### 5.1 Send Flow

**New file:** `app/send/page.tsx` (or modal overlay)

Steps:
1. **Recipient** — paste address or ENS name. Resolves ENS via `viem`. Shows address book suggestions.
2. **Token + Amount** — select token (ETH, USDC, USDT), enter amount. Shows USD equivalent via price feed.
3. **Review** — confirm recipient, amount, estimated gas fee (slow/standard/fast selector), total cost
4. **Sign** — connect wallet if not connected, sign tx via wagmi `useSendTransaction` or `useWriteContract`
5. **Status** — pending → confirmed (with tx hash + BaseScan link)

**New file:** `src/lib/gas/estimate.ts`
- Wraps `viem`'s `estimateGas` + `eth_maxPriorityFeePerGas`
- Returns `{ slow, standard, fast }` in Gwei + USD equivalent

**New file:** `src/lib/ens/resolve.ts`
- `resolveAddress(nameOrAddress)` — if input ends in `.eth`, call ENS resolver via viem
- Returns checksummed address or throws if not found

---

#### 5.2 Receive Flow

**New file:** `components/receive-modal.tsx`
- Shows connected wallet address large + formatted
- QR code (`qrcode` npm package) encoding `ethereum:<address>`
- Network selector (change which chain to receive on)
- Copy address button with toast confirmation
- "Share" button (native share API)

---

#### 5.3 Address Book

**Prisma addition:**
```prisma
model Contact {
  id        String   @id @default(cuid())
  userId    String
  label     String
  address   String
  chainId   Int?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, address])
}
```

`app/api/contacts/route.ts` — CRUD for address book entries

**New file:** `components/address-book.tsx`
- Searchable list of saved contacts
- Add/edit/delete contact
- Used as autocomplete in the Send flow

---

#### 5.4 Transaction Simulation

**New file:** `src/lib/tx/simulate.ts`
- Before user signs, simulate the transaction using `viem`'s `simulateContract` or `call`
- If simulation reverts: show error with reason before user wastes gas
- Display: "This transaction will succeed / fail (reason: …)"

---

#### 5.5 Pending Transaction Management

**Prisma addition:**
```prisma
model PendingTx {
  id          String   @id @default(cuid())
  userId      String
  txHash      String   @unique
  chainId     Int
  type        String   // "send" | "approve" | "contract"
  description String?
  status      String   @default("pending")  // pending | confirmed | failed | replaced
  nonce       Int
  submittedAt DateTime @default(now())
  confirmedAt DateTime?
  replacedBy  String?  // txHash of speed-up/cancel replacement

  user User @relation(fields: [userId], references: [id])
}
```

- Speed-up: resubmit same tx with higher gas (same nonce, 10%+ higher tip)
- Cancel: send 0-ETH tx to self with same nonce and higher gas
- Background job polls pending txs every 15s via `/api/txs/sync/route.ts`

---

## 6. Token & Balance Management

### Current State
- No balance fetching. No token list. No price feeds.
- USDC is referenced by name only — no contract address management.

### What Needs to Be Built

#### 6.1 Token Registry

**New file:** `src/lib/tokens/registry.ts`

Static token list per chain:
```typescript
const TOKENS: Record<number, Token[]> = {
  84532: [ // Base Sepolia
    { symbol: "ETH",  name: "Ether",       decimals: 18, address: null,          logoUrl: "..." },
    { symbol: "USDC", name: "USD Coin",    decimals: 6,  address: "0x036CbD...", logoUrl: "..." },
    { symbol: "USDT", name: "Tether USD",  decimals: 6,  address: "0x...",       logoUrl: "..." },
  ],
  8453: [ // Base Mainnet
    // same structure with mainnet addresses
  ]
}
```

- `getTokens(chainId)` — list tokens for a chain
- `getToken(chainId, symbolOrAddress)` — lookup by symbol or contract address
- Custom token import: validate ERC-20 ABI presence, fetch symbol/decimals/name

---

#### 6.2 Balance Fetching

**New file:** `src/lib/tokens/balances.ts`
- `getNativeBalance(address, chainId)` — `viem` `getBalance`
- `getErc20Balance(tokenAddress, walletAddress, chainId)` — `viem` `readContract` ERC-20 `balanceOf`
- `getAllBalances(walletAddress, chainId)` — fetches all tokens in registry in parallel
- Format: `{ symbol, balance, balanceFormatted, balanceUsd }`

**New route:** `app/api/wallets/[walletId]/balances/route.ts` — `GET`
- Calls `getAllBalances` server-side (avoids CORS on RPC)
- Cached for 30s per wallet

---

#### 6.3 Price Feed

**New file:** `src/lib/prices/feed.ts`
- Fetch token prices from CoinGecko API (free tier) or Pyth Network
- `getPrice(symbol)` → USD price
- `getPrices(symbols[])` → map of symbol → USD price
- Cache prices in-memory for 60s (avoid rate limits)
- Fallback: hardcoded stale prices if API fails

---

#### 6.4 Balance UI

**New file:** `components/wallet-balance-card.tsx`
- Shows total portfolio value in USD
- Token list: icon, symbol, balance, USD value
- Sparkline mini-chart (24h) per token (optional, uses price history)
- "Add token" button → custom token import modal

**New file:** `components/token-import-modal.tsx`
- Input contract address
- Auto-fetches name, symbol, decimals from chain
- Preview + confirm add

---

#### 6.5 ERC-20 Token Approvals Dashboard

**New file:** `components/approvals-manager.tsx`
- Lists all ERC-20 `approve()` grants the wallet has given to spender contracts
- Uses Etherscan/BaseScan API to fetch `Approval` events
- Shows: token, spender address (ENS if available), allowance amount
- "Revoke" button → sends `approve(spender, 0)` transaction

---

## 7. Stablecoins & Programmable Payments

### Current State
- USDC mock payments exist in `mock-payment.ts`
- x402 HTTP payment protocol client exists (`x402-client.ts`) but is untested end-to-end
- `PraxisDeferredEscrow.sol` is designed but not deployed

### What Needs to Be Built

#### 7.1 USDC Transfer (Real)

**File:** `src/payment/usdc-transfer.ts`
- `transferUsdc(from, to, amountUsdc, chainId, walletClient)` using wagmi `writeContract`
- ERC-20 `transfer(address to, uint256 amount)` call
- Handle approval flow: check existing allowance, `approve()` if needed before transfer
- Returns tx hash, waits for 1 confirmation

---

#### 7.2 x402 Protocol — Full Implementation

**File:** `src/payment/x402-client.ts` — enhance existing

Current state: sends payment header, gets 402 response, sends with `X-Payment` header.

Needs:
- Parse `WWW-Authenticate: x402` header to extract `paymentDetails`
- Construct signed EIP-712 payment authorization
- Send with `X-Payment: <base64-encoded-signed-payload>`
- Verify `X-Payment-Response` header from vendor
- Retry logic with circuit breaker (3 failures → disable x402 for that vendor)

---

#### 7.3 Streaming Payments / Subscriptions

**New Prisma model:**
```prisma
model StreamingPayment {
  id              String   @id @default(cuid())
  tenantId        String
  payerAddress    String
  payeeAddress    String
  tokenAddress    String
  ratePerSecond   Float                         // in token units
  startedAt       DateTime
  endedAt         DateTime?
  totalStreamed   Float    @default(0)
  status          String   @default("active")   // active | paused | ended
  lastSettledAt   DateTime?
  contractAddress String?                        // if using Superfluid/Sablier
  streamId        String?                        // external stream ID
  createdAt       DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
}
```

**New file:** `src/payment/streaming.ts`
- Integration with Superfluid or Sablier v2 for on-chain streams
- `createStream(payer, payee, token, ratePerSecond)` → creates CFA (Constant Flow Agreement)
- `stopStream(streamId)` → deletes CFA
- `getStreamBalance(streamId)` → real-time streamed amount

---

#### 7.4 Deferred Escrow — Frontend Integration

`PraxisDeferredEscrow.sol` is already written. Build the client layer:

**New file:** `src/blockchain/escrow-client.ts`
- `depositToEscrow(tokenAddress, amount, walletClient)`
- `lockEscrowIntent(proofHash, runId, payer, payee, token, amount)`
- `settleEscrow(proofHash)`
- `refundEscrow(proofHash)`
- Each function: simulate → sign → submit → wait for receipt

**New file:** `app/escrow/page.tsx`
- Active escrow positions table
- Deposit / settle / refund actions
- Escrow balance per token

---

#### 7.5 Payment Mode Selector in UI

**Enhance:** `components/chat-panel.tsx`

Add a payment mode toggle (hidden behind a "settings" cog):
- `mock` — no real funds
- `x402` — HTTP payment protocol
- `usdc-direct` — direct ERC-20 transfer
- `escrow` — deferred escrow contract

Writes `NEXT_PUBLIC_PAYMENT_MODE` equivalent to local state, passed with each purchase request.

---

## 8. DeFi / Swap

### Current State
- Not built. No swap integration.

### What Needs to Be Built

#### 8.1 Token Swap via 1inch Aggregator

**New file:** `src/lib/swap/oneinch.ts`
- `getSwapQuote(fromToken, toToken, amount, chainId)` — calls 1inch `/quote` API
- `buildSwapTx(fromToken, toToken, amount, slippage, fromAddress, chainId)` — calls 1inch `/swap`
- Returns calldata ready to pass to `walletClient.sendTransaction`

---

#### 8.2 Slippage & Price Impact

**New file:** `src/lib/swap/slippage.ts`
- `calculatePriceImpact(quote)` — (expectedAmount - receivedAmount) / expectedAmount
- Warn if >1%, block if >5% (configurable)
- `calculateMinReceived(amount, slippageBps)` — amount * (1 - slippage/10000)

---

#### 8.3 Swap UI

**New file:** `app/swap/page.tsx`

Flow:
1. From token selector + amount input → shows USD value
2. ↕ Swap direction toggle
3. To token selector + estimated output (updates on debounce 500ms)
4. Price impact badge (green/yellow/red)
5. Slippage setting (0.1% / 0.5% / 1% / custom)
6. Gas fee estimate
7. "Swap" button → approval check → sign swap tx → status screen

**New file:** `components/token-selector.tsx`
- Searchable dropdown of tokens from registry
- Shows balance next to each token
- "Max" button to fill from balance

---

#### 8.4 Swap History

Reuses the `PendingTx` model from §5.5 with `type: "swap"`.
Swap history tab in `/history` page — shows from/to token, amounts, rate at time.

---

## 9. Security Layer Enhancements

### Current State
- API key auth (M2M) ✅
- Rate limiting (in-memory, per-IP) ✅
- Input sanitization ✅
- Security headers via middleware ✅
- Audit log (AuditLog model) ✅
- No user-facing 2FA, no spending limits per user, no suspicious address detection

### What Needs to Be Built

#### 9.1 Two-Factor Authentication (2FA)

**New Prisma addition:**
```prisma
// Add to User model:
totpSecret   String?    // encrypted TOTP secret (Google Authenticator compatible)
totpEnabled  Boolean    @default(false)
backupCodes  String?    // JSON array of hashed backup codes
```

**New file:** `src/lib/auth/totp.ts`
- `generateTotpSecret()` — returns base32 secret + QR code URL
- `verifyTotp(secret, token)` — validates 6-digit code with 30s window
- `generateBackupCodes()` — 10 × 8-char alphanumeric codes, stored as bcrypt hashes

`app/api/auth/2fa/setup/route.ts` — GET returns QR URI, POST verifies first code to enable
`app/api/auth/2fa/verify/route.ts` — POST during login when 2FA is active
`app/api/auth/2fa/disable/route.ts` — POST with password + current TOTP code

**Modify:** `app/api/auth/login/route.ts` — if `totpEnabled`, return `{ requiresTOTP: true, tempToken }` instead of session. Second request to `/2fa/verify` with `tempToken + totpCode` creates the full session.

---

#### 9.2 Spending Limits Per User

**New Prisma addition:**
```prisma
model SpendingLimit {
  id              String   @id @default(cuid())
  userId          String   @unique
  dailyLimitUsdc  Float    @default(10000)
  perTxLimitUsdc  Float    @default(5000)
  requireApprovalAboveUsdc Float @default(1000)
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**New file:** `src/policy/user-spending-guard.ts`
- `checkUserSpendingLimit(userId, amountUsdc)` — reads user's SpendingLimit + today's spend from Run history
- Called in `purchase-workflow.ts` before the existing budget guard
- Returns `{ approved: boolean, reason: string, dailySpentUsdc: number }`

---

#### 9.3 Suspicious Address Detection

**New file:** `src/lib/security/address-screening.ts`
- Check address against Chainalysis / TRM Labs API (or open-source blocklist)
- Free alternative: maintain a local JSON blocklist of known scam/exploit addresses
- `screenAddress(address)` → `{ safe: boolean, riskScore: number, flags: string[] }`
- Called before any send transaction

---

#### 9.4 Rate Limiting — Persist to DB

**Current:** In-memory rate limiter resets on server restart, doesn't work across multiple instances.

**New file:** `src/lib/security/rate-limiter-db.ts`
- Store rate limit counters in a `RateLimit` table (or Redis if available)
- Same sliding window logic, but survives restarts and works across replicas

---

## 10. On-chain Proof & Compliance

### Current State
- `PraxisPaymentRegistry.sol` ✅ — production-ready, records runId + proofHash + payer + payee + amount
- `registry-client.ts` ✅ — `anchorPayment()` with 8s timeout and mock fallback
- `PraxisDeferredEscrow.sol` ✅ — designed, not deployed
- No Merkle batching, no KYC flag support, no compliance report export

### What Needs to Be Built

#### 10.1 Deploy Registry to Base Sepolia

**Steps:**
1. `npx hardhat run contracts/deploy.ts --network base-sepolia`
2. Written to `src/blockchain/deployments.ts`
3. Set `CHAIN_MODE=base-sepolia` in `.env`
4. Verify contract: `npx hardhat verify --network base-sepolia <address>`

---

#### 10.2 Merkle Batch Anchoring

For high-volume scenarios: instead of one on-chain tx per run, batch multiple proofHashes into a Merkle tree and anchor only the root.

**New file:** `src/proof/merkle-batch.ts`
- `buildMerkleTree(proofHashes[])` — using `merkletreejs` + `keccak256`
- `getMerkleRoot(tree)` → bytes32 root
- `getMerkleProof(tree, proofHash)` → proof array for individual verification
- `verifyMerkleProof(root, proofHash, proof)` → boolean

**New Prisma model:**
```prisma
model MerkleBatch {
  id          String   @id @default(cuid())
  merkleRoot  String   @unique
  anchorTxHash String?
  chainId     Int
  runIds      String                          // JSON array of run IDs in this batch
  proofHashes String                          // JSON array of proof hashes
  anchoredAt  DateTime?
  createdAt   DateTime @default(now())
}
```

**New route:** `app/api/admin/batches/route.ts`
- POST: create batch from pending un-anchored runs → builds tree → anchors root → writes batch record

---

#### 10.3 Compliance Report Export

**New route:** `app/api/admin/compliance/report/route.ts` — `GET`
- Query: `?from=<ISO>&to=<ISO>&tenantId=<id>&format=pdf|csv|json`
- CSV/JSON: all runs with proof hashes, tx hashes, amounts, vendor, timestamps
- PDF: formatted report with org header, summary stats, transaction table

---

#### 10.4 KYC / AML Flags

**Prisma addition:**
```prisma
// Add to Run model:
kycStatus    String?   // "passed" | "flagged" | "pending" | null
amlFlags     String?   // JSON array of flag strings
complianceNote String?
```

**New file:** `src/lib/compliance/kyc-check.ts`
- `runKycCheck(vendorName, payeeAddress, amount)` → checks against a local rules file or third-party API
- Runs after policy guard in the workflow
- If flagged: set `kycStatus: "flagged"` and trigger HITL regardless of threshold

---

## 11. Notifications

### Current State
- No notification system. Users must actively poll the dashboard to know a run completed.

### What Needs to Be Built

#### 11.1 In-App Notifications

**New Prisma model:**
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // "run.completed" | "run.failed" | "approval.required" | "invoice.paid" | "low_balance"
  title     String
  body      String
  metadata  String?  // JSON: runId, amount, etc.
  isRead    Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, isRead])
}
```

**New route:** `app/api/notifications/route.ts` — GET (list unread), PATCH (mark all read)
**New route:** `app/api/notifications/[id]/route.ts` — PATCH (mark read), DELETE

**New file:** `src/lib/notifications/create.ts`
- `createNotification(userId, type, title, body, metadata?)` — writes to DB
- Called from workflow at completion, failure, HITL trigger

**New file:** `components/notification-bell.tsx`
- Bell icon in header with unread count badge
- Dropdown panel listing recent notifications
- Click → navigates to relevant run/invoice

**New route:** `app/api/notifications/stream/route.ts`
- SSE endpoint — streams new notification events to connected client
- Client subscribes on page load

---

#### 11.2 Email Notifications

**New file:** `src/lib/notifications/email.ts`
- `sendEmail(to, subject, htmlBody)` — uses Resend or Nodemailer
- Templates:
  - `run-completed.html` — run summary with vendor, amount, proof hash
  - `run-failed.html` — what failed and why
  - `approval-required.html` — HITL trigger with "Approve / Reject" buttons (links to `/api/runs/:id/approve`)
  - `invoice-paid.html` — invoice settled confirmation

User can configure email preferences in Profile settings (per notification type toggle).

---

#### 11.3 Low Balance Alerts

**New file:** `src/lib/notifications/balance-monitor.ts`
- Background job runs every hour via a cron route (`app/api/cron/balance-check/route.ts`)
- Checks each user's default wallet balance against their configured threshold
- Sends in-app + email notification if below threshold
- Threshold configurable in Profile settings (default: $50 USDC)

---

## 12. Admin Dashboard UI

### Current State
- Admin API routes exist (`/api/admin/tenants`, `/api/admin/tenants/:id/keys`, `/api/admin/tenants/:id/policy`, `/api/admin/tenants/:id/vendors`, `/api/admin/audit`) — all functional
- No UI for any of these. Must be operated via curl/HTTP client.

### What Needs to Be Built

**New directory:** `app/admin/`

#### 12.1 Admin Layout
**New file:** `app/admin/layout.tsx`
- Left nav: Tenants, API Keys, Policy, Vendors, Audit Log, Analytics
- Auth check: require `role: admin` session (middleware redirect if not)
- Header with admin badge

---

#### 12.2 Tenant Management
**New file:** `app/admin/tenants/page.tsx`
- Table: name, slug, isActive, key count, run count, created date
- "New Tenant" button → slide-over form
- Click row → `/admin/tenants/[tenantId]`

**New file:** `app/admin/tenants/[tenantId]/page.tsx`
- Tenant detail: overview stats, tabs for Keys / Policy / Vendors / Audit

---

#### 12.3 API Key Management
**New file:** `app/admin/tenants/[tenantId]/keys/page.tsx`
- Table: name, prefix, scopes, lastUsed, isActive, expiresAt
- "Create Key" → form → shows raw key ONCE in a modal (copy-to-clipboard enforced)
- Revoke key button (confirm dialog)
- Key scope editor (checkbox list)

---

#### 12.4 Policy Config UI
**New file:** `app/admin/tenants/[tenantId]/policy/page.tsx`
- Form with sliders/inputs for:
  - Max single payment (USDC)
  - Daily budget (USD)
  - HITL threshold (USDC) — `0` = always auto-approve
  - Require proof for all (toggle)
  - Allow mock payments (toggle)
- Save button with optimistic update + error rollback

---

#### 12.5 Vendor Allowlist UI
**New file:** `app/admin/tenants/[tenantId]/vendors/page.tsx`
- Table: vendor name, payment address, max order cap, isActive
- Add vendor form (inline row or slide-over)
- Edit / deactivate / delete per row

---

#### 12.6 Audit Log Viewer
**New file:** `app/admin/audit/page.tsx`
- Paginated table: timestamp, action, actorType, tenantId, resourceId, IP
- Filter by: tenant, action type, date range, actor
- Expand row → full metadata JSON
- Export as CSV

---

## 13. Analytics

### Current State
- No analytics. No charts. No usage stats.

### What Needs to Be Built

#### 13.1 Data Aggregation Routes

`app/api/admin/analytics/overview/route.ts` — `GET`
- `totalRuns`, `completedRuns`, `failedRuns`, `successRate`
- `totalVolumeUsdc`, `avgTransactionUsdc`
- `runsToday`, `volumeToday`
- `pendingApprovals`

`app/api/admin/analytics/timeseries/route.ts` — `GET`
- Query: `?metric=runs|volume&period=7d|30d|90d&granularity=day|hour`
- Returns array of `{ date, value }` for charting

`app/api/admin/analytics/vendors/route.ts` — `GET`
- Top vendors by run count and by volume

---

#### 13.2 Analytics Dashboard UI

**New file:** `app/admin/analytics/page.tsx`
- KPI cards row: total volume, run count, success rate, avg tx size
- Line chart: runs + volume over time (7d / 30d / 90d toggle)
- Bar chart: top vendors by volume
- Donut: run status distribution (completed/failed/pending)
- All charts use `recharts` (already in the KeilHQ design system reference)

---

## 14. Smart Contract Upgrades

### Current State
- `PraxisPaymentRegistry.sol` ✅ — production-ready, not yet deployed
- `PraxisDeferredEscrow.sol` ✅ — designed, not deployed

### What Needs to Be Built

#### 14.1 Deploy to Base Sepolia
```bash
npx hardhat run contracts/deploy.ts --network base-sepolia
npx hardhat verify --network base-sepolia <registryAddress>
npx hardhat verify --network base-sepolia <escrowAddress>
```

#### 14.2 Multi-token Registry

Enhance `PraxisPaymentRegistry.sol`:
- Add `tokenAddress` field to the `PaymentRecord` struct
- Add `token` parameter to `recordPayment()` function
- Add `getRecordsByToken(address token)` lookup
- Emit `TokenPaymentRecorded` event for indexing

#### 14.3 Upgradeable Proxy Pattern

For production longevity, wrap registry in OpenZeppelin `TransparentUpgradeableProxy`:
- Deploy implementation + ProxyAdmin + Proxy
- Update `deploy.ts` to deploy all three
- Allows bug fixes without losing historical records

#### 14.4 Event Indexing (Subgraph)

Create a The Graph subgraph for `PraxisPaymentRegistry`:
- Index `PaymentRecorded` events
- Schema: `Payment { id, runId, proofHash, payer, payee, amount, timestamp }`
- Query endpoint for fast historical lookups without scanning raw RPC logs

#### 14.5 Multi-chain Registry Deployment

Deploy `PraxisPaymentRegistry` to:
- Base Sepolia (testnet) — current target
- Base Mainnet — production
- Arbitrum Sepolia — expansion
- Polygon Mumbai — expansion

`deployments.ts` already supports per-network addresses. Update `registry-client.ts` to select address by `chainId`.

---

## 15. Multi-chain Expansion

### Current State
- Base Sepolia (`chainId: 84532`) only
- `viem` config supports custom chains — adding more is straightforward

### What Needs to Be Built

#### 15.1 Chain Config Registry

**New file:** `src/lib/chains/registry.ts`
```typescript
export const SUPPORTED_CHAINS = {
  84532:   { name: "Base Sepolia",   rpc: process.env.BASE_SEPOLIA_RPC_URL,  explorer: "https://sepolia.basescan.org" },
  8453:    { name: "Base",           rpc: process.env.BASE_RPC_URL,           explorer: "https://basescan.org" },
  137:     { name: "Polygon",        rpc: process.env.POLYGON_RPC_URL,        explorer: "https://polygonscan.com" },
  42161:   { name: "Arbitrum One",   rpc: process.env.ARBITRUM_RPC_URL,       explorer: "https://arbiscan.io" },
}
```

#### 15.2 Chain-aware Transaction Builder

**Enhance:** `src/blockchain/registry-client.ts`
- Accept `chainId` parameter
- Look up RPC URL and contract address from registries above
- Build `viem` publicClient + walletClient dynamically per chain

#### 15.3 Cross-chain Bridge UI (Stretch)

- Integrate LI.FI or Socket.tech for cross-chain token bridging
- UI: select from-chain + to-chain, token, amount
- Shows route + fee breakdown

---

## 16. Build Priority Order

This is the recommended sequence based on dependency graph and hackathon/production impact:

### Phase 1 — Foundation (Build First)
| # | Feature | Why |
|---|---|---|
| 1 | User Auth (§1) | Everything else depends on having a logged-in user |
| 2 | Deploy Registry to Base Sepolia (§14.1) | Makes proofs real, not mock |
| 3 | Transaction History UI (§3) | Highest-value visible feature, data already exists |
| 4 | Admin Dashboard UI (§12) | Makes the existing admin API actually usable |

### Phase 2 — Wallet Core
| # | Feature | Why |
|---|---|---|
| 5 | Wallet Connect (§2) | Required for real payments |
| 6 | Token Balances (§6.1–6.4) | Need balances to show wallet value |
| 7 | Send & Receive UI (§5.1–5.2) | Core wallet UX |
| 8 | USDC Real Transfer (§7.1) | Replace mock payments with real ones |

### Phase 3 — Gateway & Merchant
| # | Feature | Why |
|---|---|---|
| 9 | Invoice System (§4.1–4.4) | Merchant-facing product differentiation |
| 10 | Webhook Delivery (§4.3) | Required for merchant integrations |
| 11 | Notifications (§11) | Improves user experience significantly |
| 12 | 2FA (§9.1) | Security requirement before real money |

### Phase 4 — Advanced Features
| # | Feature | Why |
|---|---|---|
| 13 | Analytics Dashboard (§13) | Business intelligence for admins |
| 14 | x402 Full Implementation (§7.2) | Protocol differentiation |
| 15 | Deferred Escrow UI (§7.4) | Activates already-built contract |
| 16 | Spending Limits (§9.2) | Additional safety layer |

### Phase 5 — DeFi & Scale
| # | Feature | Why |
|---|---|---|
| 17 | Token Swap (§8) | DeFi utility feature |
| 18 | Merkle Batch Anchoring (§10.2) | Cost reduction at scale |
| 19 | Streaming Payments (§7.3) | Novel payment primitive |
| 20 | Multi-chain (§15) | Market expansion |
| 21 | Upgradeable Proxy (§14.3) | Production readiness |
| 22 | The Graph Subgraph (§14.4) | Indexing at scale |

---

## What Already Exists (Do Not Rebuild)

| Feature | Status | Location |
|---|---|---|
| Procurement workflow (agent → guards → proof → payment → anchor) | ✅ Complete | `src/mastra/workflows/` |
| Budget + policy guards | ✅ Complete | `src/policy/` |
| Proof-of-Reasoning hashing | ✅ Complete | `src/proof/` |
| Payment firewall (deterministic) | ✅ Complete | `src/payment/payment-firewall.ts` |
| Mock + x402 payment executor | ✅ Complete | `src/payment/` |
| Chain anchor (mock + live) | ✅ Complete | `src/blockchain/registry-client.ts` |
| M2M API key auth (SHA-256, scopes) | ✅ Complete | `src/lib/security/api-auth.ts` |
| Rate limiting | ✅ Complete | `src/lib/security/rate-limiter.ts` |
| Audit log (AuditLog model) | ✅ Complete | DB + `app/api/admin/audit/` |
| Multi-tenant (Tenant, PolicyConfig, VendorAllowlist) | ✅ Complete | Prisma schema + admin API |
| HITL approval flow | ✅ Complete | `app/api/runs/[runId]/approve/` |
| Security headers + CORS | ✅ Complete | `middleware.ts` |
| PraxisPaymentRegistry.sol | ✅ Ready to deploy | `contracts/` |
| PraxisDeferredEscrow.sol | ✅ Ready to deploy | `contracts/` |
| Dashboard UI (chat → timeline → cards) | ✅ Complete | `app/page.tsx` + `components/` |

---

*Total estimated new files: ~65 · New Prisma models: 8 · New API routes: ~35*
