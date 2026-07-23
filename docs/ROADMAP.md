# Praxis — Full Product Roadmap

> **What this doc is:** A complete specification of every feature to build for Praxis as a production-grade blockchain payment gateway. Security requirements (rate limiting, CAPTCHA, re-auth, PIN) are documented **inline within each feature** — not as a separate concern.
>
> **Last updated:** 2026-07-21
> **Current status:** MVP core complete. See `CONTEXT.md` for what's already built.

---

## Table of Contents

1. [User Auth & Profile](#1-user-auth--profile)
2. [Wallet Connect & Management](#2-wallet-connect--management)
3. [Transaction History](#3-transaction-history)
4. [Payment Gateway — Merchant Side](#4-payment-gateway--merchant-side)
5. [Send & Receive](#5-send--receive)
6. [Token & Balance Management](#6-token--balance-management)
7. [Stablecoins & Programmable Payments](#7-stablecoins--programmable-payments)
8. [DeFi / Swap](#8-defi--swap)
9. [Security — Shared Infrastructure](#9-security--shared-infrastructure)
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
- No `User` model. No login/signup pages. No sessions.
- Auth is M2M only — SHA-256-hashed Bearer tokens for machine agents.
- `middleware.ts` applies security headers but does not protect page routes.

---

### 1.1 Prisma — User, Session, Auth Models

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String                        // bcrypt cost 12
  name            String?
  avatarUrl       String?
  role            String    @default("user")    // "user" | "admin"
  tenantId        String?
  isActive        Boolean   @default(true)
  walletPin       String?                       // bcrypt hash of 6-digit PIN
  walletPinSetAt  DateTime?
  totpSecret      String?                       // encrypted TOTP secret
  totpEnabled     Boolean   @default(false)
  backupCodes     String?                       // JSON array of hashed backup codes
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastLoginAt     DateTime?

  tenant    Tenant?        @relation(...)
  runs      Run[]
  sessions  Session[]
  wallets   Wallet[]
  spending  SpendingLimit?
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique               // SHA-256 of raw token
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([token])
}

// Tracks failed auth attempts per IP + per email for rate limiting
model AuthRateLimit {
  id          String   @id @default(cuid())
  key         String   @unique             // "login:<ip>" | "login_user:<emailHash>"
  attempts    Int      @default(0)
  windowStart DateTime @default(now())
  lockedUntil DateTime?
  @@index([key])
}

model SpendingLimit {
  id                       String   @id @default(cuid())
  userId                   String   @unique
  dailyLimitUsdc           Float    @default(10000)
  perTxLimitUsdc           Float    @default(5000)
  requireApprovalAboveUsdc Float    @default(1000)
  updatedAt                DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Migration: `npx prisma migrate dev --name add_users`

---

### 1.2 Auth Library

**`src/lib/auth/session.ts`**
- `createSession(userId, ip, userAgent)` → raw token (shown once), stores SHA-256
- `resolveSession(rawToken)` → user or null
- `deleteSession(rawToken)` / `deleteAllUserSessions(userId)`

**`src/lib/auth/password.ts`**
- `hashPassword(plain)` — bcrypt cost 12
- `verifyPassword(plain, hash)` — bcrypt compare

**`src/lib/auth/totp.ts`**
- `generateTotpSecret()` → base32 secret + QR URI
- `verifyTotp(secret, token)` — 30s window, ±1 window tolerance
- `generateBackupCodes()` → 10 × 8-char codes, bcrypt-hashed for storage

**`src/lib/auth/wallet-session.ts`** *(see §2 for full spec)*
- Short-lived in-memory wallet unlock token, 15-min expiry

**`src/lib/auth/action-auth.ts`**
- `verifyActionCredential(userId, method, credential)` → `{ valid: boolean }`
- Used server-side for any inline sensitive action confirmation

---

### 1.3 Auth API Routes

#### `POST /api/auth/signup`
**Security on this route:**
- CAPTCHA token required in body — always, no exceptions
  - Verified server-side via `verifyCaptcha(token)` before anything else
  - Return `400` if CAPTCHA fails
- Rate limit: 3 signup attempts per IP per hour → `HTTP 429`
- Password rules: min 8 chars, 1 uppercase, 1 number

Body: `{ email, password, name?, captchaToken }`
- Validate email format, check uniqueness
- Hash password (bcrypt 12), create User + Session
- Set `HttpOnly; SameSite=Strict` session cookie
- Write `AuditLog: "user.signup"`

---

#### `POST /api/auth/login`
**Security on this route:**
- Rate limit: 5 attempts per IP per 15 min + 10 per email per hour
  - Track both simultaneously using `AuthRateLimit` model
  - Progressive delay: attempts 4–5 add 2–5s artificial delay before responding
  - Lockout after limit: 30 min, return `HTTP 429` with `Retry-After` header
  - Reset counter on successful login
- CAPTCHA: **not required on first 3 attempts** — appears automatically after 3rd failure
  - Frontend tracks attempt count in state; shows `<CaptchaWidget>` once count ≥ 3
  - Server checks: if `AuthRateLimit.attempts >= 3` and no `captchaToken` → reject with `{ requiresCaptcha: true }`
- Never reveal which field is wrong — always "Email or password is incorrect"
- Write every failure to `AuditLog: "auth.login_failed"` with hashed email + IP

Body: `{ email, password, captchaToken? }`
- On success: create Session, set cookie, write `AuditLog: "user.login"`
- If `totpEnabled`: return `{ requiresTOTP: true, tempToken }` instead of full session

---

#### `POST /api/auth/2fa/verify`
**Security:** Rate limit 5 attempts per 10 min per user. Lock account temporarily after limit.

Body: `{ tempToken, totpCode }` or `{ tempToken, backupCode }`
- Verify tempToken validity (10-min expiry), verify TOTP or backup code
- On success: create full session, clear tempToken

---

#### `POST /api/auth/logout`
- Delete session from DB, clear cookie
- Write `AuditLog: "user.logout"`

#### `GET /api/auth/me`
- Resolve session cookie → return user (no password hash, no TOTP secret)

#### `PATCH /api/auth/password`
**Security:** Rate limit 3 attempts per 30 min. Requires current password verification.

Body: `{ currentPassword, newPassword }`
- Verify current password first
- Hash new, update DB
- Invalidate all OTHER sessions (keep current)
- Write `AuditLog: "user.password_changed"`

#### `POST /api/auth/forgot-password`
**Security:** CAPTCHA always required. Rate limit 3 per hour per email.

- Always respond "If that email exists, a reset link has been sent" — never confirm existence
- Token: `crypto.randomBytes(32)`, stored as SHA-256 hash, 1-hour expiry, single-use

#### `POST /api/auth/reset-password`
Body: `{ token, newPassword }`
- Validate token (hash lookup, expiry, not already used)
- Hash new password, mark token used, invalidate ALL sessions
- Write `AuditLog: "user.password_reset"`

---

### 1.4 2FA Setup Routes

`GET /api/auth/2fa/setup` → returns QR URI + backup codes preview (requires session)
`POST /api/auth/2fa/setup` — body `{ totpCode }` — verifies first code, enables 2FA, stores secret
`POST /api/auth/2fa/disable` — body `{ password, totpCode }` — requires both to disable

---

### 1.5 Middleware — Route Protection

**File:** `middleware.ts` — extend existing (keep all security headers + CORS)

```
/login, /signup, /auth/*          → public (no session needed)
/profile*, /history*, /wallet/*   → redirect to /login if no session
/send*, /swap*, /escrow/*         → redirect to /login, then /wallet/reauth if no wallet session
/admin*                           → redirect to /login if not role:admin
/api/auth/*                       → public
/api/wallets/*, /api/send/*       → require wallet session header
```

---

### 1.6 Pages

#### `app/login/page.tsx`
- Email + password form
- CAPTCHA widget (`<CaptchaWidget>`) — hidden on mount, slides in after 3rd failed attempt
  - Once visible, submit button stays disabled until CAPTCHA is solved
- "Remember me" — extends session 30 days vs default 24h
- Error messages: generic only ("Email or password is incorrect")
- Lockout state: shows "Too many attempts. Try again in X minutes." + live countdown
- After 2nd failure: subtle hint "X attempts remaining before lockout"

#### `app/signup/page.tsx`
- Name, email, password, confirm password
- Password strength bar (weak / fair / strong / very strong) — updates live as user types
- **CAPTCHA always shown** — form submit disabled until solved
- Terms checkbox

#### `app/auth/forgot-password/page.tsx` + `app/auth/reset-password/[token]/page.tsx`
- Both require CAPTCHA
- Reset page: new password + confirm, redirects to login on success

---

### 1.7 Profile Page — `app/profile/page.tsx`

#### Identity section
- Avatar (initials fallback, upload custom image)
- Name — inline edit
- Email — display only; change requires password confirmation + CAPTCHA

#### Security section
- **Change password** — current password required, rate limited (3/30min)
- **Two-factor auth** — toggle; setup shows QR code + backup codes; disable requires password + TOTP
- **Wallet PIN** — "Set up PIN" → 6-dot PIN pad → confirm PIN → bcrypt save
  - Once set: "PIN active ✓", options to Change PIN or Remove PIN (both require current password)
- **Active sessions** — table: device, browser, IP, last active; "Revoke" per row
- **Sign out everywhere** button

#### Wallet Lock Settings
- "Require re-auth to view wallet" — always ON, cannot be disabled (banking-style)
- Re-auth method: PIN (if set) or Password
- Session timeout: 5 / 15 / 30 min (default 15)
- "Always require CAPTCHA on wallet re-auth" — default ON

#### Spending Controls
- Daily spend limit (USDC) — input + current-day usage bar showing X of Y used
- Per-transaction limit (USDC)
- "Require manual confirmation above" threshold (maps to HITL threshold)

#### Linked Wallets *(see §2)*
#### Run History *(see §3 — recent 5 + "View all")*

#### Danger Zone
- Delete account — requires password + CAPTCHA, 24h delay before execution

---

## 2. Wallet Connect & Management

### Current State
- `viem` installed, used server-side only. No browser wallet integration.
- No wallet connect UI, no balance display, no user-facing address management.

---

### 2.1 Prisma — Wallet Model

```prisma
model Wallet {
  id         String   @id @default(cuid())
  userId     String
  address    String                        // checksummed EVM address
  chainId    Int
  label      String?                       // user nickname e.g. "My MetaMask"
  walletType String   @default("injected") // injected | walletconnect | coinbase | ledger
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, address, chainId])
}
```

Migration: `npx prisma migrate dev --name add_wallets`

---

### 2.2 Dependencies

```bash
npm install @rainbow-me/rainbowkit wagmi @tanstack/react-query
```

**`src/lib/wagmi/config.ts`** — configure chains (Base Sepolia + Base Mainnet), RPC transports, connectors (MetaMask, WalletConnect, Coinbase)

**`app/layout.tsx`** — wrap with `<WagmiProvider>`, `<QueryClientProvider>`, `<RainbowKitProvider>`

---

### 2.3 Wallet Re-authentication — Bank/UPI Style Lock

Viewing wallet balances or initiating any transaction requires a fresh re-auth even if the main app session is active. This is the same model used by banking apps and UPI — the app session grants dashboard access; a separate short-lived wallet session grants financial access.

**`src/lib/auth/wallet-session.ts`**
```typescript
// In-memory Map — survives page refresh via re-auth, not persisted to DB
const walletSessions = new Map<string, { expiresAt: Date }>();

export function grantWalletSession(sessionId: string, timeoutMins: number): void
export function hasWalletSession(sessionId: string): boolean
export function revokeWalletSession(sessionId: string): void
```

#### `POST /api/wallet/reauth`
**Security on this route:**
- CAPTCHA always required — `captchaToken` in body, verified before anything else
- Rate limit: 5 attempts per 10 min per user → `HTTP 429`
- After 5 failures: lock for 15 min, escalate to full re-login after 10 total failures
- Write `AuditLog: "wallet.reauth"` on every attempt (success and failure)

Body: `{ method: "pin" | "password", credential: string, captchaToken: string }`
- Verify CAPTCHA first
- Check rate limit
- `method: "pin"` → bcrypt compare against `user.walletPin`
  - PIN validation: reject if all same digits (111111) or sequential (123456)
- `method: "password"` → bcrypt compare against `user.passwordHash`
- On success: `grantWalletSession(sessionId, userTimeout)`, return `{ granted: true, expiresIn: seconds }`

#### `POST /api/wallet/pin` — set PIN
#### `PUT /api/wallet/pin` — change PIN (requires current password)
#### `DELETE /api/wallet/pin` — remove PIN (requires current password)

**PIN rules enforced server-side:**
- Exactly 6 digits
- Not all same (111111, 222222…)
- Not ascending sequential (123456)
- Not descending sequential (654321)
- Not date-like patterns (e.g., current year)

#### `app/wallet/reauth/page.tsx`

UI flow:
1. Lock icon + "Enter your PIN or password to access your wallet"
2. **If PIN is set:** 6-dot PIN pad (UPI-style, 3×4 grid, 1–9 + 0 + backspace)
   - Dots fill as user types: ● ● ○ ○ ○ ○
   - Auto-submits on 6th digit
   - Wrong PIN: dots shake (CSS animation) then clear
   - "Use password instead" link below
3. **If no PIN:** password field
4. CAPTCHA widget always visible below input
5. Failure feedback: "X attempts remaining" after each wrong attempt
6. After 5 failures: locked state, countdown timer, "Try again in X:XX"
7. On success: redirect to the originally requested page (stored in query param `?next=`)

**`components/pin-pad.tsx`**
- 3×4 numeric grid
- Dot row display: 6 circles, fill on input
- Shake animation on wrong entry
- Keyboard support (numpad + number row)
- Accessible: `aria-label` per button, focus management

---

### 2.4 Wallet API Routes

`GET /api/wallets` — list user's wallets (requires app session)
`POST /api/wallets` — link wallet
  - Requires wallet session (re-auth gate)
  - Signature proof: user signs `Sign to link wallet to Praxis. Nonce: <N>. Time: <T>`
  - Verify signature server-side via `viem verifyMessage`
  - Rate limit: 5 new wallets per hour

`POST /api/wallets/challenge` — get nonce for ownership proof

`PATCH /api/wallets/[id]` — rename, set default (requires app session)
`DELETE /api/wallets/[id]`
  - **Security:** requires inline password confirmation (`confirmActionModal`)
  - Write `AuditLog: "wallet.removed"`

---

### 2.5 Inline Confirmation for Sensitive Wallet Actions

Certain actions require inline re-confirmation without a full page redirect — a modal that asks for PIN or password, plus CAPTCHA for high-value operations.

**`components/confirm-action-modal.tsx`**
```tsx
// Props:
// - title, description
// - method: "pin" | "password" | "pin_or_password"
// - requireCaptcha: boolean
// - onConfirm(credential: string, captchaToken?: string): Promise<void>
// - onCancel(): void
```

| Action | Method | CAPTCHA |
|---|---|---|
| Remove linked wallet | Password | No |
| Send any amount | PIN or password | No |
| Send > $500 | PIN + password | Yes |
| Approve HITL payment | PIN or password | No |
| Revoke API key | Password | No |
| Change password | Current password | No |
| Disable 2FA | Password + TOTP | No |
| Delete account | Password | Yes |

---

### 2.6 UI Components

**`components/wallet-connect-button.tsx`** — RainbowKit `<ConnectButton>` themed to Praxis dark palette
**`components/wallet-manager.tsx`** — list of linked wallets, add/remove/set-default
**`components/address-display.tsx`** — `0x1234…abcd` with copy button + BaseScan link
**`components/network-badge.tsx`** — current network dot + chain switcher dropdown

---

## 3. Transaction History

### Current State
- `Run` model has full data. `GET /api/runs` works but returns all runs with no pagination or user filter.
- No history UI — dashboard only shows the current active run.

---

### 3.1 API Enhancements

`GET /api/runs` — add query params:
- `?page=1&limit=20` — cursor pagination
- `?status=completed|failed|awaiting_approval`
- `?from=<ISO>&to=<ISO>`
- `?search=<string>` — matches prompt text
- `?userId=me` — filter to current user's runs

**Security:** Requires valid session. Rate limit 30 req/min (reuses existing limiter).

`GET /api/runs/export` — CSV or JSON download
- Same filters + `?format=csv|json`
- Rate limit: 5 exports per hour per user (prevent bulk scraping)
- `Content-Disposition: attachment; filename="praxis-runs-<date>.csv"`

---

### 3.2 Pages & Components

**`app/history/page.tsx`**
- Filter bar: status tabs, date range picker, search input
- Run list, newest first
- Each row: status badge, prompt (truncated), vendor, amount, date, proof hash
- Click row → `<RunDetailDrawer>`

**`components/run-history-table.tsx`** — virtualized list, infinite scroll
**`components/run-detail-drawer.tsx`** — right slide-over with full run cards + event timeline

---

### 3.3 Real-time Run Updates

**`app/api/runs/[runId]/stream/route.ts`** — SSE endpoint
- Streams `RunEvent` rows as they're created
- Client subscribes while run is `running` or `awaiting_approval`
- Replaces the current 1500ms `setInterval` polling in `page.tsx`

**Security:** Requires session. Validates that the requesting user owns the run.

---

## 4. Payment Gateway — Merchant Side

### Current State
- `POST /api/purchase` accepts a plain-English prompt. No invoice concept.
- No merchant portal, no payment links, no webhook delivery.

---

### 4.1 Prisma — Invoice & Webhook Models

```prisma
model Invoice {
  id              String    @id @default(cuid())
  tenantId        String
  createdByUserId String?
  reference       String?
  description     String
  amountUsdc      Float
  tokenAddress    String    @default("USDC")
  payToAddress    String
  status          String    @default("pending")  // pending|paid|expired|cancelled
  expiresAt       DateTime?
  paidAt          DateTime?
  paidByAddress   String?
  paidInRunId     String?
  paymentLink     String    @unique
  memo            String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tenant            Tenant @relation(...)
  webhookDeliveries WebhookDelivery[]
}

model WebhookEndpoint {
  id        String   @id @default(cuid())
  tenantId  String
  url       String
  secret    String                              // HMAC-SHA256 signing secret (encrypted at rest)
  events    String   @default("invoice.paid,run.completed,run.failed")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant     Tenant @relation(...)
  deliveries WebhookDelivery[]
}

model WebhookDelivery {
  id             String   @id @default(cuid())
  endpointId     String
  invoiceId      String?
  event          String
  payload        String
  responseStatus Int?
  responseBody   String?
  attemptCount   Int      @default(0)
  nextRetryAt    DateTime?
  deliveredAt    DateTime?
  createdAt      DateTime @default(now())
}
```

---

### 4.2 Invoice API Routes

**Security on all invoice write routes:** Require session + wallet session (re-auth gate).

`POST /api/invoices` — create invoice
  - Rate limit: 20 invoices per hour per tenant
`GET /api/invoices` — list (paginated, filterable by status)
`GET /api/invoices/[id]` — public (used by payment page, no auth)
`PATCH /api/invoices/[id]` — cancel — requires password confirmation
`GET /api/invoices/[id]/qr` — returns PNG QR code

**`app/pay/[paymentLink]/page.tsx`** — public payment page
- Shows invoice: description, amount, QR, expiry countdown
- "Pay with wallet" → RainbowKit connect + USDC transfer
- Real-time status polling until confirmed

---

### 4.3 Webhook Delivery

**`src/lib/webhooks/deliver.ts`**
- Sign payload: `HMAC-SHA256(secret, JSON.stringify(payload))`
- Header: `X-Praxis-Signature: sha256=<hex>`
- Retry: 1min → 5min → 30min → 2h (max 4 attempts)
- Writes `WebhookDelivery` row per attempt

**Security:** Webhook URLs validated against SSRF blocklist (no private IPs, no localhost).

---

### 4.4 Merchant UI

**`app/invoices/page.tsx`** — invoice list, create button, copy link, download QR
**`components/create-invoice-modal.tsx`** — form with PIN confirmation before saving
**`components/invoice-card.tsx`** — compact summary card

---

## 5. Send & Receive

### Current State
- All payments go through the agent workflow. No manual send UI.

---

### 5.1 Send Flow

**`app/send/page.tsx`**

Steps:
1. Recipient — address or ENS. Screened against suspicious address list before proceeding.
2. Token + Amount — token selector, USD equivalent via price feed
3. Review — recipient, amount, gas (slow/standard/fast)
4. **Confirm** — `<ConfirmActionModal>`:
   - Any amount: PIN or password required
   - > $500: PIN + password + CAPTCHA required
5. Sign via wagmi → Status screen with tx hash + BaseScan link

**`src/lib/gas/estimate.ts`** — `estimateGas` + `eth_maxPriorityFeePerGas` → `{ slow, standard, fast }`
**`src/lib/ens/resolve.ts`** — ENS lookup via viem
**`src/lib/tx/simulate.ts`** — simulate before signing; show revert reason if it would fail
**`src/lib/security/address-screening.ts`** — screen against blocklist before send

**Security:** Send route requires wallet session. All send attempts written to `AuditLog`.

---

### 5.2 Receive

**`components/receive-modal.tsx`** — address QR, copy, network selector, native share

---

### 5.3 Address Book

```prisma
model Contact {
  id        String   @id @default(cuid())
  userId    String
  label     String
  address   String
  chainId   Int?
  createdAt DateTime @default(now())
  user User @relation(...)
  @@unique([userId, address])
}
```

`app/api/contacts/route.ts` — CRUD
**`components/address-book.tsx`** — searchable, used as autocomplete in Send

---

### 5.4 Pending Transaction Management

```prisma
model PendingTx {
  id          String   @id @default(cuid())
  userId      String
  txHash      String   @unique
  chainId     Int
  type        String   // send | approve | swap | contract
  description String?
  status      String   @default("pending")
  nonce       Int
  submittedAt DateTime @default(now())
  confirmedAt DateTime?
  replacedBy  String?
  user User @relation(...)
}
```

- Speed-up: same nonce, ≥10% higher gas tip — requires PIN confirmation
- Cancel: self-send 0 ETH, same nonce, higher gas — requires PIN confirmation
- Background sync: `app/api/txs/sync/route.ts` polls every 15s

---

## 6. Token & Balance Management

### Current State
- No balance fetching. No token list. No price feeds.

---

### 6.1 Token Registry

**`src/lib/tokens/registry.ts`**
```typescript
const TOKENS: Record<number, Token[]> = {
  84532: [ // Base Sepolia
    { symbol: "ETH",  name: "Ether",    decimals: 18, address: null, logoUrl: "..." },
    { symbol: "USDC", name: "USD Coin", decimals: 6,  address: "0x036CbD...", logoUrl: "..." },
    { symbol: "USDT", name: "Tether",   decimals: 6,  address: "0x...", logoUrl: "..." },
  ],
  8453: [ /* Base Mainnet */ ]
}
```

- `getTokens(chainId)`, `getToken(chainId, symbolOrAddress)`
- Custom token import: validate ERC-20 ABI, fetch name/symbol/decimals from chain

---

### 6.2 Balance Fetching

**`src/lib/tokens/balances.ts`**
- `getNativeBalance(address, chainId)` — viem `getBalance`
- `getErc20Balance(token, wallet, chainId)` — viem `readContract` ERC-20 `balanceOf`
- `getAllBalances(wallet, chainId)` — parallel fetch all registry tokens

**`app/api/wallets/[walletId]/balances/route.ts`** — `GET`
- Calls `getAllBalances` server-side (avoids client CORS)
- Cached 30s per wallet
- **Security:** Requires wallet session (re-auth gate)

---

### 6.3 Price Feed

**`src/lib/prices/feed.ts`**
- CoinGecko free API or Pyth Network
- `getPrice(symbol)` → USD, `getPrices(symbols[])` → map
- In-memory cache 60s
- Fallback: hardcoded stale prices if API fails

---

### 6.4 Balance UI

**`components/wallet-balance-card.tsx`**
- Total portfolio USD value
- Token list: icon, balance, USD value
- "Add token" → custom import modal

**`components/token-import-modal.tsx`**
- Input contract address
- Auto-fetch metadata from chain
- Preview + confirm

---

### 6.5 ERC-20 Approvals Manager

**`components/approvals-manager.tsx`**
- Lists all `approve()` grants via Etherscan API
- Shows: token, spender (ENS-resolved), allowance
- "Revoke" → sends `approve(spender, 0)` — **requires PIN confirmation**

**Security:** Every revoke logged to `AuditLog: "token.approval_revoked"`.

---

## 7. Stablecoins & Programmable Payments

### Current State
- USDC mock payments exist. x402 client exists but untested end-to-end.
- `PraxisDeferredEscrow.sol` designed but not deployed.

---

### 7.1 USDC Transfer (Real)

**`src/payment/usdc-transfer.ts`**
- `transferUsdc(from, to, amount, chainId, walletClient)` via wagmi `writeContract`
- Checks existing allowance → `approve()` if needed → `transfer()`
- Returns tx hash, waits 1 confirmation

---

### 7.2 x402 Protocol — Full Implementation

**`src/payment/x402-client.ts`** — enhance existing:
- Parse `WWW-Authenticate: x402` → extract payment details
- Construct EIP-712 signed payment authorization
- Send with `X-Payment: <base64>`
- Verify `X-Payment-Response`
- Circuit breaker: 3 failures → disable x402 for that vendor

---

### 7.3 Streaming Payments

```prisma
model StreamingPayment {
  id              String   @id @default(cuid())
  tenantId        String
  payerAddress    String
  payeeAddress    String
  tokenAddress    String
  ratePerSecond   Float
  startedAt       DateTime
  endedAt         DateTime?
  totalStreamed   Float    @default(0)
  status          String   @default("active")
  lastSettledAt   DateTime?
  contractAddress String?
  streamId        String?
  createdAt       DateTime @default(now())
  tenant Tenant @relation(...)
}
```

**`src/payment/streaming.ts`** — Superfluid or Sablier v2 integration
- `createStream(payer, payee, token, ratePerSecond)`
- `stopStream(streamId)`
- `getStreamBalance(streamId)`

**Security:** Stream creation requires wallet session + PIN confirmation.

---

### 7.4 Deferred Escrow UI

**`src/blockchain/escrow-client.ts`** — client for `PraxisDeferredEscrow.sol`
- `depositToEscrow(token, amount, walletClient)` — **requires PIN confirmation**
- `lockEscrowIntent(proofHash, runId, payer, payee, token, amount)`
- `settleEscrow(proofHash)` — **requires PIN confirmation**
- `refundEscrow(proofHash)` — **requires password + CAPTCHA confirmation**

**`app/escrow/page.tsx`**
- Active positions table
- Deposit / settle / refund actions
- Each action protected by `<ConfirmActionModal>`

---

## 8. DeFi / Swap

### Current State
- Not built.

---

### 8.1 Token Swap via 1inch

**`src/lib/swap/oneinch.ts`**
- `getSwapQuote(from, to, amount, chainId)` — 1inch `/quote`
- `buildSwapTx(from, to, amount, slippage, fromAddress, chainId)` — 1inch `/swap`
- Returns calldata for `walletClient.sendTransaction`

---

### 8.2 Slippage & Price Impact

**`src/lib/swap/slippage.ts`**
- `calculatePriceImpact(quote)` — `(expected - received) / expected`
- Warn >1%, block >5% (configurable)
- `calculateMinReceived(amount, slippageBps)`

---

### 8.3 Swap UI

**`app/swap/page.tsx`**

Flow:
1. From token + amount
2. To token + estimated output (debounced 500ms)
3. Price impact badge (green/yellow/red)
4. Slippage setting (0.1% / 0.5% / 1% / custom)
5. Gas estimate
6. **"Swap" button** — triggers:
   - Check allowance → approve if needed (PIN confirmation)
   - **Confirm swap** (PIN confirmation, CAPTCHA if swap > $1000)
   - Sign tx → status screen

**Security:** Swap route requires wallet session. Every swap logged to `AuditLog`.

**`components/token-selector.tsx`** — searchable dropdown with balances + "Max" button

---

### 8.4 Swap History

Reuses `PendingTx` model with `type: "swap"`.
History tab in `/history` — shows from/to tokens, amounts, rate.

---

## 9. Security — Shared Infrastructure

This section covers only the **shared utilities** used by all features. Feature-specific security (rate limits, CAPTCHA, re-auth) is documented inline in §1–8.

---

### 9.1 CAPTCHA — Shared Service

**Provider:** Cloudflare Turnstile (free, privacy-respecting, invisible by default)

**Install:**
```bash
npm install @marsidev/react-turnstile
```

**`src/lib/security/captcha.ts`**
```typescript
export async function verifyCaptcha(token: string): Promise<{ success: boolean; score?: number }> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });
  return res.json();
}
```

**`components/captcha-widget.tsx`**
```tsx
import { Turnstile } from "@marsidev/react-turnstile";

export function CaptchaWidget({ onVerify }: { onVerify: (token: string) => void }) {
  return (
    <Turnstile
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      onSuccess={onVerify}
      options={{ theme: "dark", size: "flexible" }}
    />
  );
}
```

**Environment variables:**
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=   # From Cloudflare Turnstile dashboard
TURNSTILE_SECRET_KEY=             # Server-side verification secret
```

---

### 9.2 Rate Limiting — Shared Utilities

**`src/lib/security/auth-rate-limiter.ts`**

DB-backed rate limiter using `AuthRateLimit` model. Survives restarts, works across replicas.

```typescript
export async function authRateLimit(
  key: string,
  config: { max: number; windowMs: number; lockoutMs?: number }
): Promise<{ ok: boolean; retryAfter?: number }>
```

Used by:
- `POST /api/auth/login` — 5 per 15min per IP + 10 per hour per email
- `POST /api/auth/signup` — 3 per hour per IP
- `POST /api/auth/2fa/verify` — 5 per 10min per user
- `POST /api/wallet/reauth` — 5 per 10min per user
- `POST /api/auth/pin/verify` — 3 per 5min per user
- `POST /api/invoices` — 20 per hour per tenant
- `POST /api/wallets` — 5 per hour per user
- `GET /api/runs/export` — 5 per hour per user

**`src/lib/security/rate-limiter-db.ts`** (for non-auth routes)
- Same sliding window, persisted to a separate `RateLimit` table
- Used by API routes: `/api/runs`, `/api/vendor/*`, etc.

---

### 9.3 Suspicious Address Screening

**`src/lib/security/address-screening.ts`**
- Chainalysis / TRM Labs API integration (paid) or local JSON blocklist (free)
- `screenAddress(address)` → `{ safe: boolean, riskScore: number, flags: string[] }`
- Called before any send, swap, invoice payment
- Blocks: known scam contracts, sanctioned addresses, phishing sites

**Security:** Every blocked address logged to `AuditLog: "address.blocked"` with risk flags.

---

### 9.4 Spending Limits — Per-User Guard

**`src/policy/user-spending-guard.ts`**
- `checkUserSpendingLimit(userId, amountUsdc)` — reads `SpendingLimit` + today's spend from `Run` history
- Called in `purchase-workflow.ts` before existing tenant budget guard
- Returns `{ approved: boolean, reason: string, dailySpentUsdc: number }`
- If limit exceeded: trigger HITL regardless of threshold

---

### 9.5 Audit Log — All Security Events

Every security-relevant action written to `AuditLog`:
- `user.signup`, `user.login`, `auth.login_failed`
- `user.logout`, `user.password_changed`, `user.password_reset`
- `user.2fa_enabled`, `user.2fa_disabled`
- `wallet.linked`, `wallet.removed`, `wallet.reauth`
- `wallet.pin_set`, `wallet.pin_changed`, `wallet.pin_removed`
- `token.approval_revoked`
- `address.blocked`
- `run.create`, `run.approve`, `run.reject`
- `key.create`, `key.revoke`
- `policy.update`, `vendor.add`, `vendor.remove`

All log entries include: `tenantId`, `userId`, `actorType` (user/system/api_key), `ipAddress`, `metadata` (sanitized), `createdAt`.

---

## 10. On-chain Proof & Compliance

### Current State
- `PraxisPaymentRegistry.sol` ✅ production-ready
- `registry-client.ts` ✅ `anchorPayment()` with 8s timeout
- No Merkle batching, no KYC flags, no compliance reports

---

### 10.1 Deploy Registry to Base Sepolia

```bash
npx hardhat run contracts/deploy.ts --network base-sepolia
npx hardhat verify --network base-sepolia <address>
```

Set `CHAIN_MODE=base-sepolia` in `.env`.

---

### 10.2 Merkle Batch Anchoring

For high-volume: batch multiple `proofHashes` into Merkle tree, anchor only root.

**`src/proof/merkle-batch.ts`** — using `merkletreejs` + `keccak256`
- `buildMerkleTree(proofHashes[])`, `getMerkleRoot(tree)`, `getMerkleProof(tree, proofHash)`, `verifyMerkleProof(root, proofHash, proof)`

```prisma
model MerkleBatch {
  id           String   @id @default(cuid())
  merkleRoot   String   @unique
  anchorTxHash String?
  chainId      Int
  runIds       String   // JSON array
  proofHashes  String   // JSON array
  anchoredAt   DateTime?
  createdAt    DateTime @default(now())
}
```

`POST /api/admin/batches` — create batch from pending runs → anchor root

---

### 10.3 Compliance Report Export

`GET /api/admin/compliance/report`
- Query: `?from=<ISO>&to=<ISO>&tenantId=<id>&format=pdf|csv|json`
- CSV/JSON: all runs with proof hashes, tx hashes, amounts, vendor, timestamps
- PDF: formatted report with org header, summary stats

**Security:** Requires `role: admin`. Rate limit 10 exports per hour.

---

### 10.4 KYC / AML Flags

Add to `Run` model:
```prisma
kycStatus      String?  // passed | flagged | pending
amlFlags       String?  // JSON array
complianceNote String?
```

**`src/lib/compliance/kyc-check.ts`**
- `runKycCheck(vendorName, payeeAddress, amount)` → checks local rules or third-party API
- Runs after policy guard in workflow
- If flagged: set `kycStatus: "flagged"`, trigger HITL regardless of threshold

---

## 11. Notifications

### Current State
- No notification system.

---

### 11.1 In-App Notifications

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // run.completed | run.failed | approval.required | invoice.paid | low_balance
  title     String
  body      String
  metadata  String?  // JSON
  isRead    Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())
  user User @relation(...)
  @@index([userId, isRead])
}
```

`GET /api/notifications` — list unread
`PATCH /api/notifications` — mark all read
`PATCH /api/notifications/[id]` — mark read
`DELETE /api/notifications/[id]`

**`src/lib/notifications/create.ts`** — `createNotification(userId, type, title, body, metadata?)`
Called from workflow on run completion, failure, HITL trigger.

**`components/notification-bell.tsx`** — header bell icon + unread badge + dropdown panel

`GET /api/notifications/stream` — SSE endpoint for real-time push

---

### 11.2 Email Notifications

**`src/lib/notifications/email.ts`** — Resend or Nodemailer
Templates: `run-completed.html`, `run-failed.html`, `approval-required.html`, `invoice-paid.html`

User toggles per notification type in Profile settings.

---

### 11.3 Low Balance Alerts

**`src/lib/notifications/balance-monitor.ts`**
- Cron job: `app/api/cron/balance-check/route.ts` — runs hourly
- Checks default wallet balance vs user threshold
- Sends in-app + email if below (default $50 USDC)

---

## 12. Admin Dashboard UI

### Current State
- Admin API routes exist. No UI.

---

**New directory:** `app/admin/`

### 12.1 Admin Layout
**`app/admin/layout.tsx`** — left nav, auth check `role: admin`

### 12.2 Tenant Management
**`app/admin/tenants/page.tsx`** — table, create tenant
**`app/admin/tenants/[tenantId]/page.tsx`** — detail + tabs for keys/policy/vendors/audit

### 12.3 API Key Management
**`app/admin/tenants/[tenantId]/keys/page.tsx`** — table, create key (shows raw once), revoke, scope editor

### 12.4 Policy Config UI
**`app/admin/tenants/[tenantId]/policy/page.tsx`** — form with sliders for limits, toggles

### 12.5 Vendor Allowlist UI
**`app/admin/tenants/[tenantId]/vendors/page.tsx`** — table, add/edit/delete vendor

### 12.6 Audit Log Viewer
**`app/admin/audit/page.tsx`** — paginated table, filters, expand row for metadata JSON, export CSV

---

## 13. Analytics

### Current State
- No analytics.

---

### 13.1 Data Routes

`GET /api/admin/analytics/overview` — total runs, volume, success rate, pending approvals
`GET /api/admin/analytics/timeseries` — `?metric=runs|volume&period=7d|30d|90d&granularity=day|hour`
`GET /api/admin/analytics/vendors` — top vendors by count + volume

---

### 13.2 Analytics UI

**`app/admin/analytics/page.tsx`**
- KPI cards: total volume, run count, success rate, avg tx
- Line chart: runs + volume over time (recharts)
- Bar chart: top vendors
- Donut: run status distribution

---

## 14. Smart Contract Upgrades

### 14.1 Deploy to Base Sepolia
```bash
npx hardhat run contracts/deploy.ts --network base-sepolia
npx hardhat verify --network base-sepolia <registryAddress> <escrowAddress>
```

### 14.2 Multi-token Registry
Enhance `PraxisPaymentRegistry.sol`:
- Add `tokenAddress` field to `PaymentRecord`
- Add `token` param to `recordPayment()`
- Add `getRecordsByToken(address)` lookup

### 14.3 Upgradeable Proxy
Wrap registry in OpenZeppelin `TransparentUpgradeableProxy`:
- Deploy implementation + ProxyAdmin + Proxy
- Update `deploy.ts`

### 14.4 Event Indexing (Subgraph)
The Graph subgraph for `PraxisPaymentRegistry`:
- Index `PaymentRecorded` events
- Schema: `Payment { id, runId, proofHash, payer, payee, amount, timestamp }`

### 14.5 Multi-chain Deployment
Deploy registry to Base Sepolia, Base Mainnet, Arbitrum, Polygon.
Update `deployments.ts` and `registry-client.ts` to select by `chainId`.

---

## 15. Multi-chain Expansion

### 15.1 Chain Registry
**`src/lib/chains/registry.ts`**
```typescript
export const SUPPORTED_CHAINS = {
  84532: { name: "Base Sepolia", rpc: process.env.BASE_SEPOLIA_RPC_URL, explorer: "..." },
  8453:  { name: "Base", rpc: process.env.BASE_RPC_URL, explorer: "..." },
  // Add Arbitrum, Polygon, etc.
}
```

### 15.2 Chain-aware Transaction Builder
Enhance `registry-client.ts` to accept `chainId`, look up RPC + contract address dynamically.

### 15.3 Cross-chain Bridge UI (Stretch)
Integrate LI.FI or Socket.tech for cross-chain bridging.

---

## 16. Build Priority Order

### Phase 1 — Foundation
| # | Feature | Why |
|---|---|---|
| 1 | User Auth + rate limiting + CAPTCHA (§1) | Foundation for everything |
| 2 | Wallet PIN + Re-auth (§1.7, §2.3) | Banking-style security gate before wallet features |
| 3 | Deploy Registry (§14.1) | Makes proofs real |
| 4 | Transaction History UI (§3) | High-value visible feature |

### Phase 2 — Wallet Core
| # | Feature | Why |
|---|---|---|
| 5 | Wallet Connect (§2) | Required for real payments |
| 6 | Token Balances (§6) | Show wallet value |
| 7 | Send & Receive (§5) | Core wallet UX |
| 8 | USDC Real Transfer (§7.1) | Replace mock |

### Phase 3 — Gateway & Merchant
| # | Feature | Why |
|---|---|---|
| 9 | Invoice System (§4) | Merchant differentiation |
| 10 | Webhook Delivery (§4.3) | Required for integrations |
| 11 | Notifications (§11) | UX improvement |
| 12 | Admin Dashboard (§12) | Makes admin API usable |

### Phase 4 — Advanced
| # | Feature | Why |
|---|---|---|
| 13 | 2FA (§1.3, §1.4) | Security before production |
| 14 | Analytics (§13) | Business intelligence |
| 15 | x402 Full (§7.2) | Protocol differentiation |
| 16 | Spending Limits (§9.4) | Safety layer |

### Phase 5 — DeFi & Scale
| # | Feature | Why |
|---|---|---|
| 17 | Swap (§8) | DeFi utility |
| 18 | Merkle Batching (§10.2) | Cost reduction |
| 19 | Streaming Payments (§7.3) | Novel primitive |
| 20 | Multi-chain (§15) | Market expansion |

---

## What Already Exists (Do Not Rebuild)

| Feature | Status | Location |
|---|---|---|
| Procurement workflow | ✅ Complete | `src/mastra/workflows/` |
| Budget + policy guards | ✅ Complete | `src/policy/` |
| Proof hashing | ✅ Complete | `src/proof/` |
| Payment firewall | ✅ Complete | `src/payment/payment-firewall.ts` |
| Mock + x402 executor | ✅ Complete | `src/payment/` |
| Chain anchor | ✅ Complete | `src/blockchain/registry-client.ts` |
| M2M API key auth | ✅ Complete | `src/lib/security/api-auth.ts` |
| Rate limiting (API) | ✅ Complete | `src/lib/security/rate-limiter.ts` |
| Audit log | ✅ Complete | `AuditLog` model + admin API |
| Multi-tenant | ✅ Complete | Prisma + admin API |
| HITL approval | ✅ Complete | `app/api/runs/[runId]/approve/` |
| Security headers | ✅ Complete | `middleware.ts` |
| PraxisPaymentRegistry.sol | ✅ Ready | `contracts/` |
| PraxisDeferredEscrow.sol | ✅ Ready | `contracts/` |
| Dashboard UI | ✅ Complete | `app/page.tsx` + `components/` |

---

**Total new files:** ~70 · **New Prisma models:** 10 · **New API routes:** ~40

**Security additions:** Rate limiting on 12 routes, CAPTCHA on 8 routes, wallet re-auth gate on 6 route groups, PIN confirmation on 10 actions, password confirmation on 8 actions.
