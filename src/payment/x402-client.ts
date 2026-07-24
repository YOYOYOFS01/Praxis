/**
 * x402 Payment Client
 *
 * Implements the full x402 payment cycle:
 *   1. GET resource → 402 response
 *   2. Parse 402 body, build PaymentAuthorization
 *   3. EIP-712 sign authorization
 *   4. Retry GET with X-Payment header
 *   5. On 200: extract X-Payment-Response, build PaymentReceipt, persist to runStore
 *
 * Includes circuit breaker (per vendor) and timeout-based hybrid fallback.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.3
 */

import type { PaymentIntent, PaymentReceipt } from "@/src/types/payment";
import { buildMockReceipt } from "./mock-payment";
import { signPaymentAuthorization } from "@/src/gateway/eip712-signer";
import { getDefaultChain } from "@/src/gateway/chain-config";
import { runStore } from "@/src/store/run-store";
import { privateKeyToAddress } from "viem/accounts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FACILITATOR_TIMEOUT_MS = 6000;
const CIRCUIT_BREAKER_THRESHOLD = 3;

/** Per-vendor failure counts — module-level state, persists for process lifetime */
const vendorFailureCounts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Thrown when the x402 facilitator returns a verification failure that the
 * caller must treat as a hard error (e.g. invalid_signature, amount_mismatch).
 * Do NOT fall back to hybrid — set the run to failed instead.
 */
export class PaymentVerificationError extends Error {
  constructor(public readonly reason: string) {
    super(`Payment verification failed: ${reason}`);
    this.name = "PaymentVerificationError";
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Body402 {
  amount: string;
  payTo: string;
  nonce: string;
  expiry: string;
  asset: string;
  network: string;
}

interface XPaymentResponseData {
  txHash?: string;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Execute an x402 payment for the given intent.
 *
 * Circuit breaker: if the vendor has failed >= CIRCUIT_BREAKER_THRESHOLD times,
 * skip x402 entirely and return a hybrid mock receipt immediately.
 *
 * On facilitator timeout or network error: increment failure count, fall back
 * to hybrid.
 *
 * On PaymentVerificationError: rethrow — caller must mark the run as failed.
 */
export async function executeX402Payment(intent: PaymentIntent): Promise<PaymentReceipt> {
  const vendorKey = intent.payeeAddress ?? intent.runId;

  // Circuit breaker: vendor already degraded
  const currentFailures = vendorFailureCounts.get(vendorKey) ?? 0;
  if (currentFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.info(
      `[x402-client] Vendor ${vendorKey} is x402-degraded (${currentFailures} failures), routing to hybrid`
    );
    return buildMockReceipt(intent, { mode: "hybrid" });
  }

  try {
    const receipt = await Promise.race([
      _executeX402Cycle(intent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FACILITATOR_TIMEOUT")), FACILITATOR_TIMEOUT_MS)
      ),
    ]);
    return receipt;
  } catch (err) {
    // PaymentVerificationError must propagate — do not fall back
    if (err instanceof PaymentVerificationError) {
      throw err;
    }

    // Timeout or network error: increment failure count, maybe degrade
    const newCount = (vendorFailureCounts.get(vendorKey) ?? 0) + 1;
    vendorFailureCounts.set(vendorKey, newCount);

    if (newCount >= CIRCUIT_BREAKER_THRESHOLD) {
      console.warn(
        `[x402-client] Vendor ${vendorKey} reached failure threshold (${newCount}), marked x402-degraded`
      );
    } else {
      console.warn(
        `[x402-client] Facilitator failed for vendor ${vendorKey} (failure ${newCount}/${CIRCUIT_BREAKER_THRESHOLD}):`,
        err
      );
    }

    return buildMockReceipt(intent, { mode: "hybrid" });
  }
}

// ---------------------------------------------------------------------------
// Internal payment cycle
// ---------------------------------------------------------------------------

/**
 * Full x402 payment cycle:
 *   a) GET resource (no X-Payment) → expect 402
 *   b) Parse 402 body
 *   c) Resolve agent private key, derive payer address
 *   d) Build PaymentAuthorization and EIP-712 sign it
 *   e) Retry GET with X-Payment header
 *   f) On second 402: read error body, throw PaymentVerificationError for hard reasons
 *   g) On non-200: throw
 *   h) On 200: build PaymentReceipt, persist, return
 */
async function _executeX402Cycle(intent: PaymentIntent): Promise<PaymentReceipt> {
  // a) Resource URL
  const resourceUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/api/vendor/protected-data";

  // b) Initial GET — expect 402
  const res402 = await fetch(resourceUrl, { method: "GET" });
  if (res402.status !== 402) {
    throw new Error(`Expected HTTP 402, got ${res402.status}`);
  }

  // Parse 402 body: { amount, payTo, nonce, expiry, asset, network }
  const body402 = (await res402.json()) as Body402;

  // c) Resolve agent private key
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
  if (!agentPrivateKey) {
    throw new Error("AGENT_PRIVATE_KEY not set");
  }

  // d) Derive payer address and chain ID
  const payer = privateKeyToAddress(agentPrivateKey);
  const chainId = getDefaultChain().chainId;

  // Build authorization struct
  const authorization = {
    payer,
    payTo: body402.payTo,
    asset: body402.asset,
    network: body402.network,
    amount: body402.amount,
    resource: resourceUrl,
    nonce: body402.nonce,
    expiry: Math.floor(new Date(body402.expiry).getTime() / 1000),
  };

  // f) EIP-712 sign authorization
  const paymentHeader = await signPaymentAuthorization(authorization, agentPrivateKey, chainId);

  // g) Retry GET with X-Payment header
  const paidRes = await fetch(resourceUrl, {
    method: "GET",
    headers: { "X-Payment": paymentHeader },
  });

  // h) Server rejected the payment — check reason
  if (paidRes.status === 402) {
    const errorBody = (await paidRes.json()) as { reason?: string };
    const reason = errorBody.reason ?? "unknown";
    if (reason === "invalid_signature" || reason === "amount_mismatch") {
      throw new PaymentVerificationError(reason);
    }
    throw new Error(`Payment rejected: ${reason}`);
  }

  // i) Any other non-200 is unexpected
  if (paidRes.status !== 200) {
    throw new Error(`Unexpected status: ${paidRes.status}`);
  }

  // j) Extract X-Payment-Response header
  const xPaymentResponseHeader = paidRes.headers.get("X-Payment-Response");
  let xPaymentData: XPaymentResponseData | null = null;
  if (xPaymentResponseHeader) {
    try {
      xPaymentData = JSON.parse(xPaymentResponseHeader) as XPaymentResponseData;
    } catch {
      // Non-JSON header — treat as missing
    }
  }

  // k) Build receipt
  const receipt: PaymentReceipt = {
    runId: intent.runId,
    proofHash: intent.proofHash,
    mode: "x402",
    txHash: xPaymentData?.txHash ?? `0x_x402_${Date.now().toString(16)}`,
    settledAt: new Date().toISOString(),
    amountUsdc: intent.amountUsdc,
    payeeAddress: intent.payeeAddress,
    x402PaymentHeader: paymentHeader,
  };

  // l) Persist receipt
  await runStore.setPayment(intent.runId, receipt);

  // m) Return receipt
  return receipt;
}
