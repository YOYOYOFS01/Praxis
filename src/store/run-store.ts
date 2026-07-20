import { prisma } from "@/src/db/prisma";
import type { PurchaseIntent, VendorQuote } from "@/src/types/purchase";
import type { BudgetDecision, PolicyDecision, ProofOfReasoning, ProofHash } from "@/src/types/proof";
import type { PaymentReceipt, ChainAnchor } from "@/src/types/payment";
import type { RunStatus, RunEventInput } from "@/src/types/run";

// SQLite doesn't support Json columns — we store serialised strings
const s  = (v: unknown) => JSON.stringify(v);
const p  = <T>(v: string | null | undefined): T | undefined =>
  v ? (JSON.parse(v) as T) : undefined;

export const runStore = {
  async create(runId: string, prompt: string, tenantId?: string | null): Promise<void> {
    await prisma.run.create({
      data: { id: runId, prompt, status: "running", tenantId: tenantId ?? null },
    });
  },

  async setStatus(runId: string, status: RunStatus): Promise<void> {
    await prisma.run.update({ where: { id: runId }, data: { status } });
  },

  async addEvent(runId: string, event: RunEventInput): Promise<void> {
    await prisma.runEvent.create({
      data: {
        runId,
        type:    event.type,
        label:   event.label,
        status:  event.status,
        payload: s(event.payload ?? {}),
      },
    });
  },

  async setIntent(runId: string, intent: PurchaseIntent): Promise<void> {
    await prisma.run.update({ where: { id: runId }, data: { intentJson: s(intent) } });
  },

  async setQuote(runId: string, quote: VendorQuote): Promise<void> {
    await prisma.run.update({ where: { id: runId }, data: { quoteJson: s(quote) } });
  },

  async setBudget(runId: string, budget: BudgetDecision): Promise<void> {
    await prisma.run.update({ where: { id: runId }, data: { budgetJson: s(budget) } });
  },

  async setPolicy(runId: string, policy: PolicyDecision): Promise<void> {
    await prisma.run.update({ where: { id: runId }, data: { policyJson: s(policy) } });
  },

  async setProof(runId: string, proof: ProofOfReasoning, hash: ProofHash): Promise<void> {
    await prisma.run.update({
      where: { id: runId },
      data: { proofJson: s(proof), proofHash: hash },
    });
  },

  async setPayment(runId: string, receipt: PaymentReceipt): Promise<void> {
    await prisma.run.update({ where: { id: runId }, data: { receiptJson: s(receipt) } });
  },

  async setChainAnchor(runId: string, anchor: ChainAnchor): Promise<void> {
    await prisma.run.update({ where: { id: runId }, data: { chainAnchorJson: s(anchor) } });
  },

  async getById(runId: string) {
    const row = await prisma.run.findUnique({
      where: { id: runId },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) return null;
    return deserialiseRun(row);
  },

  async listAll() {
    const rows = await prisma.run.findMany({
      orderBy: { createdAt: "desc" },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    return rows.map(deserialiseRun);
  },
};

// ── Deserialise all JSON string fields back to objects ──────────────────────
type RawRun = Awaited<ReturnType<typeof prisma.run.findUnique>> & {
  events: { id: string; runId: string; type: string; label: string; status: string; payload: string | null; createdAt: Date }[];
};

function deserialiseRun(row: NonNullable<RawRun>) {
  return {
    ...row,
    intentJson:      p(row.intentJson),
    quoteJson:       p(row.quoteJson),
    budgetJson:      p(row.budgetJson),
    policyJson:      p(row.policyJson),
    proofJson:       p(row.proofJson),
    paymentJson:     p(row.paymentJson),
    receiptJson:     p(row.receiptJson),
    protectedJson:   p(row.protectedJson),
    chainAnchorJson: p(row.chainAnchorJson),
    events: row.events.map((e) => ({
      ...e,
      payload: p(e.payload),
    })),
  };
}
