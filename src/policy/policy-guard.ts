import { prisma } from "@/src/db/prisma";
import type { PurchaseIntent, VendorQuote } from "@/src/types/purchase";
import type { PolicyDecision } from "@/src/types/proof";

// ── Fallback hardcoded list (used when no DB tenant is resolved) ──────────────
const GLOBAL_APPROVED_VENDORS = [
  "techvendor inc",
  "apple business store",
  "dell technologies",
  "microsoft store",
  "amazon business",
  "mock vendor",
];

/**
 * Deterministic policy guard — no LLM, no network calls.
 *
 * When tenantId is provided, checks the DB vendor allowlist for that tenant.
 * Falls back to the global hardcoded list for local/demo mode.
 */
export async function runPolicyGuard(
  intent: PurchaseIntent,
  quote: VendorQuote,
  tenantId?: string | null
): Promise<PolicyDecision> {
  const violations: string[] = [];
  const vendorLower = intent.vendorName.toLowerCase();

  // ── Vendor check ─────────────────────────────────────────────────────────
  let vendorRecord = null;

  if (tenantId) {
    vendorRecord = await prisma.vendorAllowlist.findFirst({
      where: { tenantId, vendorName: vendorLower, isActive: true },
    });
    if (!vendorRecord) {
      violations.push("VENDOR_NOT_WHITELISTED");
    }
  } else {
    // Demo mode — check global list
    if (!GLOBAL_APPROVED_VENDORS.includes(vendorLower)) {
      violations.push("VENDOR_NOT_WHITELISTED");
    }
  }

  // ── Per-vendor payment address lock ──────────────────────────────────────
  if (vendorRecord?.paymentAddress) {
    if (quote.paymentAddress.toLowerCase() !== vendorRecord.paymentAddress.toLowerCase()) {
      violations.push("PAYMENT_ADDRESS_MISMATCH");
    }
  }

  // ── Per-vendor order cap ─────────────────────────────────────────────────
  if (vendorRecord?.maxOrderUsdc && intent.totalAmountUsd > vendorRecord.maxOrderUsdc) {
    violations.push("EXCEEDS_VENDOR_ORDER_CAP");
  }

  // ── Sanity checks (always run) ────────────────────────────────────────────
  if (intent.quantity <= 0) {
    violations.push("INVALID_QUANTITY");
  }

  if (intent.totalAmountUsd !== intent.quantity * intent.unitPriceUsd) {
    // Allow floating point tolerance of $0.01
    if (Math.abs(intent.totalAmountUsd - intent.quantity * intent.unitPriceUsd) > 0.01) {
      violations.push("AMOUNT_MISMATCH");
    }
  }

  // Quote total must match intent total
  if (Math.abs(quote.totalAmountUsd - intent.totalAmountUsd) > 0.01) {
    violations.push("QUOTE_INTENT_MISMATCH");
  }

  if (violations.length > 0) {
    return {
      approved: false,
      violatedPolicies: violations,
      reason: `Policy violations: ${violations.join(", ")}.`,
    };
  }

  return {
    approved: true,
    violatedPolicies: [],
    reason: "Vendor is whitelisted and all policy checks passed.",
  };
}
