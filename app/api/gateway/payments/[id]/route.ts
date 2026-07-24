import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";

// GET /api/gateway/payments/[id] — single payment detail with linked intent

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const payment = await prisma.paymentRecord.findUnique({
    where: { id: params.id },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Find the linked PaymentIntent by nonce (shared with PaymentRecord)
  const intent = await prisma.paymentIntent.findUnique({
    where: { nonce: payment.nonce },
  });

  return NextResponse.json({ payment, intent: intent ?? null });
}
